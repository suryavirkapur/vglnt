
#pragma once
#include <cstddef>
#include <vector>

namespace lstm
{

    struct Matrix
    {
        float *data;
        size_t rows;
        size_t cols;

        Matrix(size_t r, size_t c);
        ~Matrix();
    };

    struct LSTMWeights
    {
        Matrix *forget_gate;
        Matrix *input_gate;
        Matrix *cell_gate;
        Matrix *output_gate;
        Matrix *hidden_state;
    };

    struct LSTMConfig
    {
        size_t input_size;
        size_t hidden_size;
        size_t num_layers;
        float learning_rate;
    };

}