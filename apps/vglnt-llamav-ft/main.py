import torch
from transformers import AutoModelForVision2Seq, AutoProcessor, BitsAndBytesConfig
from peft import LoraConfig
from trl import SFTTrainer, SFTConfig
from datasets import Dataset
import json
from PIL import Image
import os

MODEL_ID = "meta-llama/Llama-3.2-11B-Vision-Instruct"
OUTPUT_DIR = "fine-tuned-driving-vision"


def load_and_prepare_dataset(data_dir):
    dataset_items = []

    for img_file in os.listdir(os.path.join(data_dir, "images")):
        if img_file.endswith((".jpg", ".png")):
            image_path = os.path.join(data_dir, "images", img_file)
            json_path = os.path.join(
                data_dir, "annotations", f"{os.path.splitext(img_file)[0]}.json"
            )

            if os.path.exists(json_path):
                with open(json_path, "r") as f:
                    annotation = json.load(f)

                dataset_items.append(
                    {
                        "image": Image.open(image_path).convert("RGB"),
                        "annotation": json.dumps(annotation, indent=2),
                    }
                )

    return Dataset.from_list(dataset_items)


def format_data(sample):
    return {
        "messages": [
            {
                "role": "system",
                "content": [
                    {
                        "type": "text",
                        "text": "You are an expert driving scene analyzer. Convert the image into a structured JSON output describing road conditions, vehicles, traffic signs, and potential hazards.",
                    }
                ],
            },
            {
                "role": "user",
                "content": [
                    {
                        "type": "text",
                        "text": "Analyze this driving scene and provide a structured JSON output containing all relevant information.",
                    },
                    {
                        "type": "image",
                        "image": sample["image"],
                    },
                ],
            },
            {
                "role": "assistant",
                "content": [{"type": "text", "text": sample["annotation"]}],
            },
        ],
    }


def collate_fn(examples, processor):
    texts = [
        processor.apply_chat_template(example["messages"], tokenize=False)
        for example in examples
    ]
    images = [example["messages"][1]["content"][1]["image"] for example in examples]

    batch = processor(text=texts, images=images, return_tensors="pt", padding=True)
    labels = batch["input_ids"].clone()

    labels[labels == processor.tokenizer.pad_token_id] = -100

    image_tokens = [processor.tokenizer.convert_tokens_to_ids(processor.image_token)]
    for image_token_id in image_tokens:
        labels[labels == image_token_id] = -100

    batch["labels"] = labels
    return batch


def main():
    bnb_config = BitsAndBytesConfig(
        load_in_4bit=True,
        bnb_4bit_use_double_quant=True,
        bnb_4bit_quant_type="nf4",
        bnb_4bit_compute_dtype=torch.bfloat16,
    )

    model = AutoModelForVision2Seq.from_pretrained(
        MODEL_ID,
        device_map="auto",
        torch_dtype=torch.bfloat16,
        quantization_config=bnb_config,
    )
    processor = AutoProcessor.from_pretrained(MODEL_ID)

    dataset = load_and_prepare_dataset("driving_dataset")
    formatted_dataset = dataset.map(format_data)

    peft_config = LoraConfig(
        lora_alpha=16,
        lora_dropout=0.05,
        r=8,
        bias="none",
        target_modules=["q_proj", "v_proj"],
        task_type="CAUSAL_LM",
    )

    training_args = SFTConfig(
        output_dir=OUTPUT_DIR,
        num_train_epochs=3,
        per_device_train_batch_size=4,
        gradient_accumulation_steps=8,
        gradient_checkpointing=True,
        optim="adamw_torch_fused",
        logging_steps=5,
        save_strategy="epoch",
        learning_rate=2e-4,
        bf16=True,
        max_grad_norm=0.3,
        warmup_ratio=0.03,
        lr_scheduler_type="constant",
        push_to_hub=True,
        report_to="tensorboard",
        dataset_kwargs={"skip_prepare_dataset": True},
    )

    trainer = SFTTrainer(
        model=model,
        args=training_args,
        train_dataset=formatted_dataset,
        data_collator=lambda x: collate_fn(x, processor),
        tokenizer=processor.tokenizer,
        peft_config=peft_config,
    )

    trainer.train()

    trainer.save_model()


if __name__ == "__main__":
    main()
