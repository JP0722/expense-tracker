package main

import (
	"context"
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"expense-tracker/internal/app"
	"github.com/joho/godotenv"
)

func main() {
	if err := godotenv.Load(); err != nil && !os.IsNotExist(err) {
		log.Fatal("Could not load .env: ", err)
	}
	secure := os.Getenv("APP_ENV") == "production"
	origin := os.Getenv("APP_ORIGIN")
	if secure && !app.ValidateOrigin(origin) {
		log.Fatal("APP_ORIGIN must be your public HTTPS origin in production")
	}
	db, err := app.OpenDB()
	if err != nil {
		log.Fatal(err)
	}
	defer db.Close()
	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}
	static := os.Getenv("STATIC_DIR")
	if static == "" {
		static = "web/dist"
	}
	srv := &http.Server{Addr: ":" + port, Handler: app.New(db, secure, origin, static), ReadHeaderTimeout: 5 * time.Second, ReadTimeout: 15 * time.Second, WriteTimeout: 30 * time.Second, IdleTimeout: 60 * time.Second, MaxHeaderBytes: 1 << 16}
	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()
	go func() {
		<-ctx.Done()
		shutdown, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()
		_ = srv.Shutdown(shutdown)
	}()
	log.Printf("Penny is ready at http://localhost:%s", port)
	if err = srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
		log.Fatal(err)
	}
}
