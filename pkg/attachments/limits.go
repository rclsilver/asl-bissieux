// Package attachments defines the shared limits for uploads and delivery.
package attachments

import (
	"errors"
	"fmt"
	"math"

	"github.com/rclsilver/asl-bissieux/pkg/config"
)

var ErrTooLarge = errors.New("pièces jointes trop volumineuses")

type Limits struct {
	MaxFileBytes     int64 `mapstructure:"max_file_bytes"`
	MaxTemplateBytes int64 `mapstructure:"max_template_bytes"`
}

func (l *Limits) SetDefaults() {
	l.MaxFileBytes = 10 << 20
	l.MaxTemplateBytes = 20 << 20
}

var limits Limits

func init() {
	config.RegisterSection("attachments", &limits)
	config.OnLoaded(func() error {
		if limits.MaxFileBytes <= 0 || limits.MaxTemplateBytes < limits.MaxFileBytes || limits.MaxFileBytes > math.MaxInt64-(1<<20) {
			return fmt.Errorf("limites pièces jointes invalides : 0 < max_file_bytes <= max_template_bytes requis")
		}
		return nil
	})
}

func Current() Limits { return limits }

// Multipart fields and framing also need a bound, before parsing any file.
func MaxRequestBytes() int64 { return limits.MaxFileBytes + (1 << 20) }

func CheckFileSize(size int64) error {
	if size > limits.MaxFileBytes {
		return fmt.Errorf("%w : maximum %g Mio par fichier", ErrTooLarge, float64(limits.MaxFileBytes)/(1<<20))
	}
	return nil
}
