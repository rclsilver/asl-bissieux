package mailings

import (
	"errors"
	"os"
	"strings"

	"github.com/ovh/go-ovh/ovh"
)

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
	// Require all credentials and targets from the process environment before SDK creation.
	cfg := Config{
		Endpoint:          os.Getenv("OVH_ENDPOINT"),
		ApplicationKey:    os.Getenv("OVH_APPLICATION_KEY"),
		ApplicationSecret: os.Getenv("OVH_APPLICATION_SECRET"),
		ConsumerKey:       os.Getenv("OVH_CONSUMER_KEY"),
		Domain:            os.Getenv("APP_ML_DOMAIN"),
		Members:           os.Getenv("APP_ML_MEMBERS"),
		Bureau:            os.Getenv("APP_ML_BUREAU"),
	}
	if cfg == (Config{}) {
		return nil, nil
	}
	if _, ok := ovh.Endpoints[cfg.Endpoint]; !ok || cfg.ApplicationKey == "" || cfg.ApplicationSecret == "" || cfg.ConsumerKey == "" || !validPart(cfg.Domain) || !validPart(cfg.Members) || !validPart(cfg.Bureau) || cfg.Members == cfg.Bureau {
		return nil, errors.New("configuration OVH incomplète ou listes invalides")
	}
	return &cfg, nil
}
func validPart(s string) bool {
	return s != "" && !strings.ContainsAny(s, "/\\?#@ \t\r\n") && s != "." && s != ".."
}
