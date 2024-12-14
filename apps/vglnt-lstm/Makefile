CXX = g++
NVCC = nvcc
CXXFLAGS = -std=c++17 -O3 -Wall -Wextra
CUDA_FLAGS = -arch=sm_75 -std=c++17 -O3
INCLUDES = -I./include
LIBS = -lcudart -lcublas

SRC_DIR = src
BUILD_DIR = build
INCLUDE_DIR = include

CPP_SOURCES = $(wildcard $(SRC_DIR)/*.cpp)
CUDA_SOURCES = $(wildcard $(SRC_DIR)/*.cu)
CPP_OBJECTS = $(CPP_SOURCES:$(SRC_DIR)/%.cpp=$(BUILD_DIR)/%.o)
CUDA_OBJECTS = $(CUDA_SOURCES:$(SRC_DIR)/%.cu=$(BUILD_DIR)/%.o)

TARGET = driving_lstm

all: $(BUILD_DIR)/$(TARGET)

$(BUILD_DIR)/$(TARGET): $(CPP_OBJECTS) $(CUDA_OBJECTS)
	$(CXX) $^ -o $@ $(LIBS)

$(BUILD_DIR)/%.o: $(SRC_DIR)/%.cpp
	@mkdir -p $(BUILD_DIR)
	$(CXX) $(CXXFLAGS) $(INCLUDES) -c $< -o $@

$(BUILD_DIR)/%.o: $(SRC_DIR)/%.cu
	@mkdir -p $(BUILD_DIR)
	$(NVCC) $(CUDA_FLAGS) $(INCLUDES) -c $< -o $@

clean:
	rm -rf $(BUILD_DIR)

.PHONY: all clean