package config

import (
	"fmt"
	"reflect"
	"strings"
	"time"

	"github.com/mitchellh/mapstructure"
	"github.com/sirupsen/logrus"
	"github.com/spf13/pflag"
	"github.com/spf13/viper"

	"github.com/rclsilver/asl-bissieux/pkg/utils"
)

const (
	Filename = "asl-bissieux"
)

type Section interface {
	SetDefaults()
}

var (
	sections = make(map[string]Section)
	flags    = pflag.NewFlagSet("config", pflag.ExitOnError)
)

func RegisterSection(name string, section Section) {
	if _, exists := sections[name]; exists {
		logrus.Panicf("configuration section %q already defined", name)
	}

	section.SetDefaults()

	value := reflect.ValueOf(section)
	registerStruct(value, name)

	sections[name] = section
}

func registerStruct(value reflect.Value, prefix ...string) {
	if value.Kind() == reflect.Ptr {
		value = value.Elem()
	}

	valueType := value.Type()
	if valueType.Kind() != reflect.Struct {
		logrus.Panicf("expected struct, got %T", value.Interface())
	}

	for i := 0; i < valueType.NumField(); i++ {
		fieldValue := value.Field(i)
		fieldType := valueType.Field(i)

		name := fieldType.Tag.Get("json")
		if name == "" {
			name = utils.ToSnakeCase(fieldType.Name)
		}

		if fieldValue.Kind() == reflect.Struct {
			registerStruct(fieldValue, append(prefix, name)...)
		} else {
			usage := fieldType.Tag.Get("usage")

			if usage == "" {
				usage = fmt.Sprintf("set %s", strings.Join(append(prefix, strings.ReplaceAll(name, "_", "-")), "-"))
			}

			var env []string
			envStr := fieldType.Tag.Get("env")
			if envStr != "" && envStr != "auto" {
				env = strings.Split(envStr, ",")
			}

			registerParam(append(prefix, name), fieldValue, usage, env)
		}
	}
}

func registerParam(nameParts []string, value reflect.Value, usage string, env []string) {
	dashName := strings.ReplaceAll(strings.Join(nameParts, "-"), "_", "-")
	dotName := strings.Join(nameParts, ".")

	switch tv := value.Interface().(type) {
	case bool:
		flags.Bool(dashName, tv, usage)
	case int:
		flags.Int(dashName, tv, usage)
	case int64:
		flags.Int64(dashName, tv, usage)
	case int32:
		flags.Int32(dashName, tv, usage)
	case int16:
		flags.Int16(dashName, tv, usage)
	case int8:
		flags.Int8(dashName, tv, usage)
	case uint:
		flags.Uint(dashName, tv, usage)
	case uint64:
		flags.Uint64(dashName, tv, usage)
	case uint32:
		flags.Uint32(dashName, tv, usage)
	case uint16:
		flags.Uint16(dashName, tv, usage)
	case uint8:
		flags.Uint8(dashName, tv, usage)
	case float64:
		flags.Float64(dashName, tv, usage)
	case float32:
		flags.Float32(dashName, tv, usage)
	case time.Duration:
		flags.Duration(dashName, tv, usage)
	case []int:
		flags.IntSlice(dashName, tv, usage)
	case []string:
		flags.StringSlice(dashName, tv, usage)
	default:
		flags.String(dashName, fmt.Sprintf("%v", tv), usage)
	}

	viper.SetDefault(dotName, value.Interface())
	viper.BindPFlag(dotName, flags.Lookup(dashName))
}

func SetFlags(cmdFlags *pflag.FlagSet) {
	cmdFlags.AddFlagSet(flags)
}

type LoadedCallback func() error

var (
	loadedCallbacks []LoadedCallback
)

func OnLoaded(f LoadedCallback) {
	loadedCallbacks = append(loadedCallbacks, f)
}

func Load() error {
	viper.SetEnvPrefix("APP")
	viper.AutomaticEnv()
	viper.SetEnvKeyReplacer(strings.NewReplacer(".", "_"))

	viper.AddConfigPath(".")
	viper.SetConfigType("yaml")

	// load the main configuration file
	viper.SetConfigName(Filename)
	if err := viper.ReadInConfig(); err != nil {
		if _, ok := err.(viper.ConfigFileNotFoundError); ok {
			logrus.Warning("no configuration file found")
		} else {
			return err
		}
	}

	// load the optional configuration file
	viper.SetConfigName(Filename + ".override")
	if err := viper.MergeInConfig(); err != nil {
		if _, ok := err.(viper.ConfigFileNotFoundError); !ok {
			logrus.WithError(err).Fatal("unable to read configuration")
		}
	}

	settings := viper.AllSettings()

	for k, v := range settings {
		if _, exists := sections[k]; !exists {
			logrus.Debugf("found %q in the configuration but section not found", k)
			continue
		}

		dec, err := mapstructure.NewDecoder(&mapstructure.DecoderConfig{
			Result:           sections[k],
			WeaklyTypedInput: true,
			DecodeHook: mapstructure.ComposeDecodeHookFunc(
				mapstructure.StringToTimeDurationHookFunc(),
				mapstructure.StringToSliceHookFunc(","),
			),
		})
		if err != nil {
			return fmt.Errorf("unable to build decoder: %v", err)
		}
		if err := dec.Decode(v); err != nil {
			return fmt.Errorf("unable to decode: %v", err)
		}
	}

	for _, f := range loadedCallbacks {
		if err := f(); err != nil {
			return err
		}
	}

	return nil
}
