#include "lstm_layer.hpp"
#include <iostream>
#include <vector>

int main()
{
    lstm::LSTMConfig config{
        .input_size = 6,
        .hidden_size = 64,
        .num_layers = 2,
        .learning_rate = 0.001f};

    lstm::LSTMLayer lstm(config);

    std::vector<float> input_data = {/* ... */};
    lstm::Matrix input(1, config.input_size);

    lstm::Matrix output(1, config.hidden_size);
    lstm.forward(input, output);

    return 0;
}