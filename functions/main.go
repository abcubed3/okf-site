package main

import (
	"bytes"
	"fmt"
	"io"
	"log"
	"net/http"
	"os"
	"time"
)

func main() {
	http.HandleFunc("/api/telemetry", telemetryHandler)

	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
		log.Printf("Defaulting to port %s", port)
	}

	log.Printf("Listening on port %s", port)
	if err := http.ListenAndServe(":"+port, nil); err != nil {
		log.Fatal(err)
	}
}

func telemetryHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method Not Allowed", http.StatusMethodNotAllowed)
		return
	}

	measurementID := os.Getenv("GA_MEASUREMENT_ID")
	apiSecret := os.Getenv("GA_API_SECRET")

	if measurementID == "" || apiSecret == "" {
		log.Printf("Warning: GA_MEASUREMENT_ID or GA_API_SECRET not set. Skipping telemetry.")
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte("OK (Skipped - missing secrets)"))
		return
	}

	// Read the JSON body from the client (e.g. install.sh)
	body, err := io.ReadAll(r.Body)
	if err != nil {
		http.Error(w, "Failed to read request body", http.StatusBadRequest)
		return
	}
	defer r.Body.Close()

	// Forward to Google Analytics Measurement Protocol
	gaURL := fmt.Sprintf("https://www.google-analytics.com/mp/collect?measurement_id=%s&api_secret=%s", measurementID, apiSecret)

	req, err := http.NewRequestWithContext(r.Context(), http.MethodPost, gaURL, bytes.NewBuffer(body))
	if err != nil {
		log.Printf("Failed to create GA request: %v", err)
		http.Error(w, "Internal Server Error", http.StatusInternalServerError)
		return
	}
	req.Header.Set("Content-Type", "application/json")

	client := &http.Client{
		Timeout: 1 * time.Second,
	}
	resp, err := client.Do(req)
	if err != nil {
		log.Printf("Failed to send to GA: %v", err)
		http.Error(w, "Bad Gateway", http.StatusBadGateway)
		return
	}
	defer resp.Body.Close()

	if resp.StatusCode >= 400 {
		gaResp, _ := io.ReadAll(resp.Body)
		log.Printf("GA rejected telemetry request (Status %d): %s", resp.StatusCode, string(gaResp))
		// We still return 200 OK to the client because the installation script doesn't care.
	}

	w.WriteHeader(http.StatusOK)
	_, _ = w.Write([]byte("OK"))
}
