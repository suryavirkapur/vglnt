#pragma once
#include "lstm_types.hpp"

namespace lstm
{
    namespace cuda
    {

        void matrix_multiply(const float *A, const float *B, float *C,
                             int M, int N, int K, cudaStream_t stream);

        void sigmoid_activation(float *data, int size, cudaStream_t stream);

        void tanh_activation(float *data, int size, cudaStream_t stream);

        void element_wise_multiply(float *A, float *B, float *C,
                                   int size, cudaStream_t stream);

    }
}