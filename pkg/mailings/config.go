package mailings

import (
	"errors"
	"net/url"
	"os"
	"strings"

	"github.com/ovh/go-ovh/ovh"
	"github.com/rclsilver/asl-bissieux/pkg/config"
)

type mailingConfig struct {
	Domain  string
	Members string
	Bureau  string
}

func (c *mailingConfig) SetDefaults() { *c = mailingConfig{} }

var targets mailingConfig

func init() {
	config.RegisterSection("ml", &targets)
}

type Config struct {
	Endpoint          string `json:"endpoint"`
	ApplicationKey    string `json:"application_key"`
	ApplicationSecret string `json:"application_secret"`
	ConsumerKey       string `json:"consumer_key"`
	Domain            string `json:"domain"`
	Members           string `json:"members_list"`
	Bureau            string `json:"bureau_list"`
}

func LoadConfig() (*Config, error) {
	// Application targets use the shared Viper loader; client credentials keep
	// the standard OVH environment names, outside Viper's APP prefix.
	cfg := Config{
		Endpoint:          os.Getenv("OVH_ENDPOINT"),
		ApplicationKey:    os.Getenv("OVH_APPLICATION_KEY"),
		ApplicationSecret: os.Getenv("OVH_APPLICATION_SECRET"),
		ConsumerKey:       os.Getenv("OVH_CONSUMER_KEY"),
		Domain:            targets.Domain,
		Members:           targets.Members,
		Bureau:            targets.Bureau,
	}
	if cfg == (Config{}) {
		return nil, nil
	}
	if !validEndpoint(cfg.Endpoint) || cfg.ApplicationKey == "" || cfg.ApplicationSecret == "" || cfg.ConsumerKey == "" || !validPart(cfg.Domain) || !validPart(cfg.Members) || !validPart(cfg.Bureau) || cfg.Members == cfg.Bureau {
		return nil, errors.New("configuration OVH incomplète ou listes invalides")
	}
	return &cfg, nil
}

// Like the OVH SDK, accept official endpoint names or an explicit HTTP(S) URL.
// In development the URL points to Smocker using the same OVH_ENDPOINT variable.
func validEndpoint(endpoint string) bool {
	if _, ok := ovh.Endpoints[endpoint]; ok {
		return true
	}
	u, err := url.ParseRequestURI(endpoint)
	return err == nil && (u.Scheme == "http" || u.Scheme == "https") && u.Hostname() != "" && u.User == nil && u.RawQuery == "" && u.Fragment == "" && !strings.ContainsAny(endpoint, "#?\\ \t\r\n") && !strings.HasSuffix(endpoint, "/")
}
func validPart(s string) bool {
	return s != "" && !strings.ContainsAny(s, "/\\?#@ \t\r\n") && s != "." && s != ".."
}
