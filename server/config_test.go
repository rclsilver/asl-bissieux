package server

import (
	"testing"

	"github.com/rclsilver/asl-bissieux/pkg/config"
)

func TestListenEnvironmentOverrides(t *testing.T) {
	previous := cfg
	t.Cleanup(func() { cfg = previous })
	t.Setenv("APP_HTTP_LISTEN_ADDRESS", "127.0.0.1")
	t.Setenv("APP_HTTP_LISTEN_PORT", "18080")
	t.Setenv("APP_HTTP_PUBLIC_HTTPS", "true")
	t.Setenv("APP_HTTP_CSP_REPORT_ONLY", "false")
	if err := config.Load(); err != nil {
		t.Fatal(err)
	}
	if cfg.ListenAddress != "127.0.0.1" || cfg.ListenPort != 18080 || !cfg.PublicHTTPS || cfg.CSPReportOnly {
		t.Fatalf("HTTP listening overrides were ignored: %+v", cfg)
	}
}
