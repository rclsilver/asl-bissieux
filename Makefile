BINARY = asl-bissieux
SOURCE_FILES = .

DOCKER_REPOSITORY ?= rclsilver
DOCKER_IMAGE = asl-bissieux

all: $(BINARY)

$(BINARY): $(SOURCE_FILES) go.mod
	CGO_ENABLED=0 go build -o $@ $(SOURCE_FILES)

docker:
	docker build -t $(DOCKER_REPOSITORY)/$(DOCKER_IMAGE) .

.PHONY: clean
clean:
	rm -f $(BINARY)
