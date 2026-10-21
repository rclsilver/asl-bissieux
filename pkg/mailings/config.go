package mailings

import (
	"encoding/json"
	"errors"
	"io"
	"strings"

	"github.com/ovh/configstore"
	"github.com/ovh/go-ovh/ovh"
)

const ConfigItem = "asl-bissieux-ovh-mailing-lists"

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
	value, err := configstore.GetItemValue(ConfigItem)
	if err != nil {
		var missing configstore.ErrItemNotFound
		if errors.As(err, &missing) {
			return nil, nil
		}
		return nil, errors.New("configuration OVH indisponible")
	}
	return ParseConfig(value)
}

func ParseConfig(value string) (*Config, error) {
	var cfg Config
	dec := json.NewDecoder(strings.NewReader(value))
	dec.DisallowUnknownFields()
	if err := dec.Decode(&cfg); err != nil {
		return nil, errors.New("configuration OVH JSON invalide")
	}
	if err := dec.Decode(new(any)); err != io.EOF {
		return nil, errors.New("configuration OVH JSON invalide")
	}
	if _, ok := ovh.Endpoints[cfg.Endpoint]; !ok || cfg.ApplicationKey == "" || cfg.ApplicationSecret == "" || cfg.ConsumerKey == "" || !validPart(cfg.Domain) || !validPart(cfg.Members) || !validPart(cfg.Bureau) || cfg.Members == cfg.Bureau {
		return nil, errors.New("configuration OVH incomplète ou listes invalides")
	}
	return &cfg, nil
}
func validPart(s string) bool {
	return s != "" && !strings.ContainsAny(s, "/\\?#@ \t\r\n") && s != "." && s != ".."
}
