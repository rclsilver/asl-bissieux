BINARY = asl-bissieux
SOURCE_FILES = .

VERSION ?= dev
COMMIT ?= $(shell git rev-parse HEAD 2>/dev/null || printf unknown)
LDFLAGS = -X github.com/rclsilver/asl-bissieux/version.Version=$(VERSION) -X github.com/rclsilver/asl-bissieux/version.Commit=$(COMMIT)

DOCKER_REPOSITORY ?= ghcr.io/rclsilver
DOCKER_IMAGE = asl-bissieux
DOCKER_TAG ?= latest

all: $(BINARY)

$(BINARY): $(SOURCE_FILES) go.mod
	CGO_ENABLED=0 go build -mod=readonly -trimpath -buildvcs=false -ldflags '$(LDFLAGS)' -o $@ $(SOURCE_FILES)

docker:
	docker build --no-cache --build-arg VERSION=$(VERSION) --build-arg COMMIT=$(COMMIT) -t $(DOCKER_REPOSITORY)/$(DOCKER_IMAGE):$(DOCKER_TAG) .

.PHONY: clean $(BINARY)
clean:
	rm -f $(BINARY)
