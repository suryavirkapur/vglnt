#include "lstm_layer.hpp"
#include "lstm_cuda_kernels.cuh"
#include <cuda_runtime.h>
#include <stdexcept>
#include <cstring>

namespace lstm
{

    struct LSTMLayer::Implementation
    {
        cudaStream_t stream;
        Matrix cell_state;
        Matrix hidden_state;

        Matrix combined_input;
        Matrix forget_gate_output;
        Matrix input_gate_output;
        Matrix cell_gate_output;
        Matrix output_gate_output;
        Matrix new_cell_state;
        Matrix new_hidden_state;

        Matrix d_combined;
        Matrix d_forget;
        Matrix d_input;
        Matrix d_cell;
        Matrix d_output;
        Matrix d_hidden;

        Implementation(const LSTMConfig &config)
            : cell_state(config.batch_size, config.hidden_size),
              hidden_state(config.batch_size, config.hidden_size),
              combined_input(config.batch_size, config.input_size + config.hidden_size),
              forget_gate_output(config.batch_size, config.hidden_size),
              input_gate_output(config.batch_size, config.hidden_size),
              cell_gate_output(config.batch_size, config.hidden_size),
              output_gate_output(config.batch_size, config.hidden_size),
              new_cell_state(config.batch_size, config.hidden_size),
              new_hidden_state(config.batch_size, config.hidden_size),
              d_combined(config.batch_size, config.input_size + config.hidden_size),
              d_forget(config.batch_size, config.hidden_size),
              d_input(config.batch_size, config.hidden_size),
              d_cell(config.batch_size, config.hidden_size),
              d_output(config.batch_size, config.hidden_size),
              d_hidden(config.batch_size, config.hidden_size)
        {
            cudaError_t error = cudaStreamCreate(&stream);
            if (error != cudaSuccess)
            {
                throw std::runtime_error("Failed to create CUDA stream");
            }

            cudaMemsetAsync(cell_state.data, 0,
                            config.batch_size * config.hidden_size * sizeof(float),
                            stream);
            cudaMemsetAsync(hidden_state.data, 0,
                            config.batch_size * config.hidden_size * sizeof(float),
                            stream);
        }

        ~Implementation()
        {
            cudaStreamSynchronize(stream);
            cudaStreamDestroy(stream);
        }
    };

    LSTMLayer::LSTMLayer(const LSTMConfig &config)
        : impl_(std::make_unique<Implementation>(config)),
          config_(config)
    {
        // xavier init for weights
        float weight_scale = sqrtf(2.0f / (config.input_size + config.hidden_size));

        weights_.forget_gate = new Matrix(config.hidden_size,
                                          config.input_size + config.hidden_size);
        weights_.input_gate = new Matrix(config.hidden_size,
                                         config.input_size + config.hidden_size);
        weights_.cell_gate = new Matrix(config.hidden_size,
                                        config.input_size + config.hidden_size);
        weights_.output_gate = new Matrix(config.hidden_size,
                                          config.input_size + config.hidden_size);

        // cuda ran nums
        cuda::initialize_weights(weights_.forget_gate->data,
                                 weights_.forget_gate->rows * weights_.forget_gate->cols,
                                 weight_scale, impl_->stream);
        cuda::initialize_weights(weights_.input_gate->data,
                                 weights_.input_gate->rows * weights_.input_gate->cols,
                                 weight_scale, impl_->stream);
        cuda::initialize_weights(weights_.cell_gate->data,
                                 weights_.cell_gate->rows * weights_.cell_gate->cols,
                                 weight_scale, impl_->stream);
        cuda::initialize_weights(weights_.output_gate->data,
                                 weights_.output_gate->rows * weights_.output_gate->cols,
                                 weight_scale, impl_->stream);
    }

    LSTMLayer::~LSTMLayer()
    {
        delete weights_.forget_gate;
        delete weights_.input_gate;
        delete weights_.cell_gate;
        delete weights_.output_gate;
    }

    void LSTMLayer::forward(const Matrix &input, Matrix &output)
    {
        // conc input + previous hidden state
        cuda::concatenate(input.data, impl_->hidden_state.data,
                          impl_->combined_input.data,
                          input.rows, input.cols,
                          impl_->hidden_state.cols, impl_->stream);

        // comopute forget gate
        cuda::matrix_multiply(weights_.forget_gate->data,
                              impl_->combined_input.data,
                              impl_->forget_gate_output.data,
                              config_.hidden_size, input.rows,
                              input.cols + impl_->hidden_state.cols,
                              impl_->stream);
        cuda::sigmoid_activation(impl_->forget_gate_output.data,
                                 impl_->forget_gate_output.rows *
                                     impl_->forget_gate_output.cols,
                                 impl_->stream);

        cuda::matrix_multiply(weights_.input_gate->data,
                              impl_->combined_input.data,
                              impl_->input_gate_output.data,
                              config_.hidden_size, input.rows,
                              input.cols + impl_->hidden_state.cols,
                              impl_->stream);

        cuda::sigmoid_activation(impl_->input_gate_output.data,
                                 impl_->input_gate_output.rows *
                                     impl_->input_gate_output.cols,
                                 impl_->stream);

        cuda::matrix_multiply(weights_.cell_gate->data,
                              impl_->combined_input.data,
                              impl_->cell_gate_output.data,
                              config_.hidden_size, input.rows,
                              input.cols + impl_->hidden_state.cols,
                              impl_->stream);
        cuda::tanh_activation(impl_->cell_gate_output.data,
                              impl_->cell_gate_output.rows *
                                  impl_->cell_gate_output.cols,
                              impl_->stream);

        cuda::matrix_multiply(weights_.output_gate->data,
                              impl_->combined_input.data,
                              impl_->output_gate_output.data,
                              config_.hidden_size, input.rows,
                              input.cols + impl_->hidden_state.cols,
                              impl_->stream);
        cuda::sigmoid_activation(impl_->output_gate_output.data,
                                 impl_->output_gate_output.rows *
                                     impl_->output_gate_output.cols,
                                 impl_->stream);

        cuda::element_wise_multiply(impl_->forget_gate_output.data,
                                    impl_->cell_state.data,
                                    impl_->new_cell_state.data,
                                    impl_->cell_state.rows * impl_->cell_state.cols,
                                    impl_->stream);
        cuda::element_wise_multiply_add(impl_->input_gate_output.data,
                                        impl_->cell_gate_output.data,
                                        impl_->new_cell_state.data,
                                        impl_->cell_state.rows * impl_->cell_state.cols,
                                        impl_->stream);

        cuda::tanh_activation(impl_->new_cell_state.data,
                              impl_->new_cell_state.rows *
                                  impl_->new_cell_state.cols,
                              impl_->stream);
        cuda::element_wise_multiply(impl_->output_gate_output.data,
                                    impl_->new_cell_state.data,
                                    impl_->new_hidden_state.data,
                                    impl_->hidden_state.rows * impl_->hidden_state.cols,
                                    impl_->stream);

        cudaMemcpyAsync(output.data, impl_->new_hidden_state.data,
                        output.rows * output.cols * sizeof(float),
                        cudaMemcpyDeviceToDevice, impl_->stream);

        std::swap(impl_->cell_state.data, impl_->new_cell_state.data);
        std::swap(impl_->hidden_state.data, impl_->new_hidden_state.data);
    }

    void LSTMLayer::backward(const Matrix &gradient, Matrix &input_gradient)
    {

        cuda::element_wise_multiply(gradient.data,
                                    impl_->output_gate_output.data,
                                    impl_->d_hidden.data,
                                    gradient.rows * gradient.cols,
                                    impl_->stream);

        cuda::tanh_backward(impl_->d_hidden.data,
                            impl_->new_cell_state.data,
                            impl_->d_cell.data,
                            impl_->cell_state.rows * impl_->cell_state.cols,
                            impl_->stream);

        cuda::element_wise_multiply(impl_->d_cell.data,
                                    impl_->cell_gate_output.data,
                                    impl_->d_input.data,
                                    impl_->cell_state.rows * impl_->cell_state.cols,
                                    impl_->stream);

        cuda::element_wise_multiply(impl_->d_cell.data,
                                    impl_->cell_state.data,
                                    impl_->d_forget.data,
                                    impl_->cell_state.rows * impl_->cell_state.cols,
                                    impl_->stream);

        cuda::element_wise_multiply(impl_->d_hidden.data,
                                    impl_->new_cell_state.data,
                                    impl_->d_output.data,
                                    impl_->cell_state.rows * impl_->cell_state.cols,
                                    impl_->stream);

        cuda::matrix_multiply_transpose(impl_->d_forget.data,
                                        impl_->combined_input.data,
                                        weights_.forget_gate->data,
                                        impl_->d_forget.rows,
                                        impl_->combined_input.cols,
                                        impl_->stream);

        cuda::matrix_multiply_transpose(impl_->d_input.data,
                                        impl_->combined_input.data,
                                        weights_.input_gate->data,
                                        impl_->d_input.rows,
                                        impl_->combined_input.cols,
                                        impl_->stream);

        cuda::matrix_multiply_transpose(impl_->d_cell.data,
                                        impl_->combined_input.data,
                                        weights_.cell_gate->data,
                                        impl_->d_cell.rows,
                                        impl_->combined_input.cols,
                                        impl_->stream);

        cuda::matrix_multiply_transpose(impl_->d_output.data,
                                        impl_->combined_input.data,
                                        weights_.output_gate->data,
                                        impl_->d_output.rows,
                                        impl_->combined_input.cols,
                                        impl_->stream);

        cuda::split_gradient(impl_->d_combined.data,
                             input_gradient.data,
                             impl_->d_hidden.data,
                             input_gradient.rows,
                             input_gradient.cols,
                             impl_->d_hidden.cols,
                             impl_->stream);
    }

    void LSTMLayer::update_weights()
    {
        cuda::apply_gradients(weights_.forget_gate->data,
                              config_.learning_rate,
                              weights_.forget_gate->rows * weights_.forget_gate->cols,
                              impl_->stream);

        cuda::apply_gradients(weights_.input_gate->data,
                              config_.learning_rate,
                              weights_.input_gate->rows * weights_.input_gate->cols,
                              impl_->stream);

        cuda::apply_gradients(weights_.cell_gate->data,
                              config_.learning_rate,
                              weights_.cell_gate->rows * weights_.cell_gate->cols,
                              impl_->stream);

        cuda::apply_gradients(weights_.output_gate->data,
                              config_.learning_rate,
                              weights_.output_gate->rows * weights_.output_gate->cols,
                              impl_->stream);
    }

    void LSTMLayer::reset_state()
    {
        cudaMemsetAsync(impl_->cell_state.data, 0,
                        impl_->cell_state.rows * impl_->cell_state.cols * sizeof(float),
                        impl_->stream);
        cudaMemsetAsync(impl_->hidden_state.data, 0,
                        impl_->hidden_state.rows * impl_->hidden_state.cols * sizeof(float),
                        impl_->stream);
    }

}