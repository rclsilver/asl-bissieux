BINARY = asl-bissieux
SOURCE_FILES = .

DOCKER_REPOSITORY ?= rclsilver
DOCKER_IMAGE = asl-bissieux
DOCKER_TAG ?= latest

all: $(BINARY)

$(BINARY): $(SOURCE_FILES) go.mod
	CGO_ENABLED=0 go build -o $@ $(SOURCE_FILES)

docker:
	docker build --no-cache -t $(DOCKER_REPOSITORY)/$(DOCKER_IMAGE):$(DOCKER_TAG) .

.PHONY: clean
clean:
	rm -f $(BINARY)
