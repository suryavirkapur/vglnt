#include "lstm_cuda_kernels.cuh"
#include <cuda_runtime.h>

namespace lstm
{
    namespace cuda
    {

        __global__ void matrix_multiply_kernel(const float *A, const float *B, float *C,
                                               int M, int N, int K)
        {
            int row = blockIdx.y * blockDim.y + threadIdx.y;
            int col = blockIdx.x * blockDim.x + threadIdx.x;

            if (row < M && col < N)
            {
                float sum = 0.0f;
                for (int i = 0; i < K; ++i)
                {
                    sum += A[row * K + i] * B[i * N + col];
                }
                C[row * N + col] = sum;
            }
        }

        __global__ void sigmoid_kernel(float *data, int size)
        {
            int idx = blockIdx.x * blockDim.x + threadIdx.x;
            if (idx < size)
            {
                data[idx] = 1.0f / (1.0f + expf(-data[idx]));
            }
        }

        __global__ void tanh_kernel(float *data, int size)
        {
            int idx = blockIdx.x * blockDim.x + threadIdx.x;
            if (idx < size)
            {
                data[idx] = tanhf(data[idx]);
            }
        }

        void matrix_multiply(const float *A, const float *B, float *C,
                             int M, int N, int K, cudaStream_t stream)
        {
            dim3 block(16, 16);
            dim3 grid((N + block.x - 1) / block.x,
                      (M + block.y - 1) / block.y);

            matrix_multiply_kernel<<<grid, block, 0, stream>>>(A, B, C, M, N, K);
        }

        void sigmoid_activation(float *data, int size, cudaStream_t stream)
        {
            int block_size = 256;
            int num_blocks = (size + block_size - 1) / block_size;
            sigmoid_kernel<<<num_blocks, block_size, 0, stream>>>(data, size);
        }

        void tanh_activation(float *data, int size, cudaStream_t stream)
        {
            int block_size = 256;
            int num_blocks = (size + block_size - 1) / block_size;
            tanh_kernel<<<num_blocks, block_size, 0, stream>>>(data, size);
        }

    }
}