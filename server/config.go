package server

import "github.com/rclsilver/asl-bissieux/pkg/config"

type httpConfig struct {
	ListenAddress string
	ListenPort    int
}

func (c *httpConfig) SetDefaults() {
	c.ListenAddress = "0.0.0.0"
	c.ListenPort = 8080
}

var (
	cfg httpConfig
)

func init() {
	config.RegisterSection("http", &cfg)
}
