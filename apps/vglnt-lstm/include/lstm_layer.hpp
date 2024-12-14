#pragma once
#include "lstm_types.hpp"
#include <memory>

namespace lstm
{

    class LSTMLayer
    {
    public:
        LSTMLayer(const LSTMConfig &config);
        ~LSTMLayer();

        void forward(const Matrix &input, Matrix &output);
        void backward(const Matrix &gradient, Matrix &input_gradient);
        void update_weights();

    private:
        struct Implementation;
        std::unique_ptr<Implementation> impl_;
        LSTMConfig config_;
        LSTMWeights weights_;
    };

}