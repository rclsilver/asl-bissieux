package server

import "github.com/rclsilver/asl-bissieux/pkg/config"

type httpConfig struct {
	ListenAddress string `mapstructure:"listen_address"`
	ListenPort    int    `mapstructure:"listen_port"`
	PublicHTTPS   bool   `mapstructure:"public_https"`
	CSPReportOnly bool   `mapstructure:"csp_report_only"`
}

func (c *httpConfig) SetDefaults() {
	c.ListenAddress = "0.0.0.0"
	c.ListenPort = 8080
	c.CSPReportOnly = true
}

var (
	cfg httpConfig
)

func init() {
	config.RegisterSection("http", &cfg)
}
