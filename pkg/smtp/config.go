package smtp

import "github.com/rclsilver/asl-bissieux/pkg/config"

type smtpConfig struct {
	Host     string `mapstructure:"host"`
	Port     int    `mapstructure:"port"`
	Username string `mapstructure:"username"`
	Password string `mapstructure:"password"`
	TLS      bool   `mapstructure:"tls"`
	From     struct {
		Name    string `mapstructure:"name"`
		Address string `mapstructure:"address"`
	} `mapstructure:"from"`
	ReplyTo struct {
		Name    string `mapstructure:"name"`
		Address string `mapstructure:"address"`
	} `mapstructure:"reply_to"`
	Template    string `mapstructure:"template"`
	TrackingURL string `mapstructure:"tracking_url"`
}

func (c *smtpConfig) SetDefaults() {
	c.Host = "localhost"
	c.Port = 25
	c.From.Address = "app@example.com"
	c.From.Name = "app"
}

var (
	cfg smtpConfig
)

func init() {
	config.RegisterSection("smtp", &cfg)
}
