package attachments

import (
	"testing"

	"github.com/rclsilver/asl-bissieux/pkg/config"
)

func TestLimitsConfiguration(t *testing.T) {
	previous := limits
	t.Cleanup(func() { limits = previous })
	for _, tc := range []struct {
		name, file, total string
		valid             bool
	}{
		{"production defaults", "10485760", "20971520", true},
		{"custom limits", "8", "12", true},
		{"zero disabled cap rejected", "0", "12", false},
		{"negative cap rejected", "-1", "12", false},
		{"total smaller than file rejected", "13", "12", false},
		{"request overhead overflow rejected", "9223372036854775807", "9223372036854775807", false},
	} {
		t.Run(tc.name, func(t *testing.T) {
			t.Setenv("APP_ATTACHMENTS_MAX_FILE_BYTES", tc.file)
			t.Setenv("APP_ATTACHMENTS_MAX_TEMPLATE_BYTES", tc.total)
			if err := config.Load(); (err == nil) != tc.valid {
				t.Fatalf("configuration validity=%t: %v", tc.valid, err)
			}
		})
	}
}
