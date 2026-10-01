package ai

import (
	"context"
	"encoding/json"
	"errors"
	"io"
	"net/http"
	"strings"
	"testing"
	"time"
)

type transportFunc func(*http.Request) (*http.Response, error)

func (f transportFunc) RoundTrip(r *http.Request) (*http.Response, error) { return f(r) }

func response(status int, body string) *http.Response {
	return &http.Response{StatusCode: status, Body: io.NopCloser(strings.NewReader(body)), Header: make(http.Header)}
}

func completion(content, finish string) string {
	b, _ := json.Marshal(map[string]any{"choices": []any{map[string]any{
		"finish_reason": finish, "message": map[string]any{"content": content},
	}}})
	return string(b)
}

const exampleDraft = `{"title":"Lunch","amount":"250.00","date":"2026-10-01","categoryId":12,"notes":null}`

func TestExtractRequestAndDrafts(t *testing.T) {
	c := NewClient("test-key", "test-model")
	c.httpClient.Transport = transportFunc(func(r *http.Request) (*http.Response, error) {
		if r.Method != "POST" || r.URL.String() != "https://api.groq.com/openai/v1/chat/completions" {
			t.Fatal("unexpected destination")
		}
		if r.Header.Get("Authorization") != "Bearer test-key" {
			t.Fatal("missing authorization")
		}
		var request struct {
			Model    string                           `json:"model"`
			Messages []struct{ Role, Content string } `json:"messages"`
			Format   struct {
				Type   string
				Schema struct{ Strict bool } `json:"json_schema"`
			} `json:"response_format"`
		}
		if err := json.NewDecoder(r.Body).Decode(&request); err != nil {
			t.Fatal(err)
		}
		if request.Model != "test-model" || request.Format.Type != "json_schema" || !request.Format.Schema.Strict {
			t.Fatal("structured output not requested")
		}
		if len(request.Messages) != 2 || request.Messages[1].Role != "user" {
			t.Fatal("input must be a separate user message")
		}
		var input Input
		if err := json.Unmarshal([]byte(request.Messages[1].Content), &input); err != nil {
			t.Fatal(err)
		}
		if input.Today != "2026-10-02" || len(input.Categories) != 1 || input.Text != "Lunch 250 yesterday" {
			t.Fatal("missing extraction context")
		}
		return response(200, completion(`{"drafts":[`+exampleDraft+`]}`, "stop")), nil
	})
	drafts, err := c.Extract(context.Background(), Input{Text: "Lunch 250 yesterday", Today: "2026-10-02", Categories: []Category{{12, "Food"}}})
	if err != nil {
		t.Fatal(err)
	}
	if len(drafts) != 1 || *drafts[0].Amount != "250.00" || *drafts[0].CategoryID != 12 || drafts[0].Notes != nil {
		t.Fatalf("unexpected drafts: %+v", drafts)
	}
}

func TestProviderFailures(t *testing.T) {
	for _, tc := range []struct {
		name   string
		status int
		body   string
		want   error
	}{
		{"quota", 429, "private provider detail", ErrRateLimited},
		{"credentials", 401, "secret", ErrUnavailable},
		{"server", 503, "private input", ErrUnavailable},
		{"redirect", 302, "", ErrUnavailable},
		{"bad envelope", 200, "{}", ErrInvalidResponse},
		{"truncated", 200, completion(`{"drafts":[]}`, "length"), ErrInvalidResponse},
		{"oversized", 200, strings.Repeat("x", maxResponseBytes+1), ErrInvalidResponse},
	} {
		t.Run(tc.name, func(t *testing.T) {
			c := NewClient("key", "")
			calls := 0
			c.httpClient.Transport = transportFunc(func(*http.Request) (*http.Response, error) { calls++; return response(tc.status, tc.body), nil })
			_, err := c.Extract(context.Background(), Input{})
			if !errors.Is(err, tc.want) || calls != 1 {
				t.Fatalf("got %v, calls %d", err, calls)
			}
		})
	}
}

func TestDecodeDrafts(t *testing.T) {
	for _, content := range []string{
		`{}`, `{"drafts":null}`, `{"drafts":[],"extra":true}`, `{"drafts":[]} {}`,
		`{"drafts":[null]}`, `{"drafts":[{"title":"Lunch"}]}`,
		`{"drafts":[` + strings.Replace(exampleDraft, `"250.00"`, `250`, 1) + `]}`,
		`{"drafts":[` + strings.TrimSuffix(strings.Repeat(exampleDraft+",", 11), ",") + `]}`,
	} {
		if _, err := decodeDrafts(content); !errors.Is(err, ErrInvalidResponse) {
			t.Errorf("accepted invalid content: %s", content)
		}
	}
	for _, content := range []string{`{"drafts":[]}`, `{"drafts":[{"title":null,"amount":null,"date":null,"categoryId":null,"notes":null}]}`} {
		if _, err := decodeDrafts(content); err != nil {
			t.Fatal(err)
		}
	}
}

func TestConfigurationAndCancellation(t *testing.T) {
	c := NewClient("", "")
	if c.model != DefaultModel || c.httpClient.Timeout != 15*time.Second {
		t.Fatal("unexpected defaults")
	}
	if _, err := c.Extract(context.Background(), Input{}); !errors.Is(err, ErrNotConfigured) {
		t.Fatal(err)
	}
	c = NewClient("key", "")
	c.httpClient.Transport = transportFunc(func(r *http.Request) (*http.Response, error) { <-r.Context().Done(); return nil, r.Context().Err() })
	ctx, cancel := context.WithCancel(context.Background())
	cancel()
	if _, err := c.Extract(ctx, Input{}); !errors.Is(err, context.Canceled) {
		t.Fatal(err)
	}
	c.httpClient.Timeout = 5 * time.Millisecond
	if _, err := c.Extract(context.Background(), Input{}); !errors.Is(err, ErrUnavailable) {
		t.Fatal(err)
	}
}
