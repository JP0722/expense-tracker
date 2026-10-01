import { useEffect, useRef, useState } from "react";

export function useSpeechRecognition(onTranscript) {
  const Recognition =
    window.SpeechRecognition || window.webkitSpeechRecognition;
  const recognition = useRef(null);
  const callback = useRef(onTranscript);
  callback.current = onTranscript;
  const [listening, setListening] = useState(false);
  const [error, setError] = useState("");
  const supported = Boolean(Recognition) && window.isSecureContext !== false;

  function start() {
    if (!supported || recognition.current) return;
    setError("");
    const session = new Recognition();
    session.lang = "en-IN";
    session.continuous = false;
    session.interimResults = false;
    recognition.current = session;
    session.onresult = (event) => {
      if (recognition.current !== session) return;
      const parts = [];
      for (let i = event.resultIndex; i < event.results.length; i++) {
        if (event.results[i].isFinal)
          parts.push(event.results[i][0].transcript);
      }
      if (parts.length) callback.current(parts.join(" "));
    };
    session.onerror = (event) => {
      if (recognition.current !== session) return;
      const messages = {
        "not-allowed":
          "Microphone permission was denied. Allow it in browser settings or type your expenses.",
        "service-not-allowed":
          "Speech recognition is unavailable. You can type your expenses.",
        "audio-capture":
          "No microphone is available. Check your microphone or type instead.",
        "no-speech": "No speech detected. Try again or type your expenses.",
        network:
          "Speech recognition could not connect. Check your connection or type instead.",
      };
      if (event.error !== "aborted")
        setError(
          messages[event.error] ||
            "Could not recognize speech. Try again or type instead.",
        );
    };
    session.onend = () => {
      if (recognition.current === session) {
        recognition.current = null;
        setListening(false);
      }
    };
    try {
      session.start();
      setListening(true);
    } catch {
      recognition.current = null;
      setListening(false);
      setError("Could not start the microphone. Try again or type instead.");
    }
  }

  function stop() {
    recognition.current?.stop();
  }

  useEffect(
    () => () => {
      const session = recognition.current;
      recognition.current = null;
      if (session) {
        session.onresult = session.onerror = session.onend = null;
        session.abort();
      }
    },
    [],
  );

  return { supported, listening, error, start, stop };
}
