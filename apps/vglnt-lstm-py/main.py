import tensorflow as tf
from tensorflow import keras
import numpy as np
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import StandardScaler
import json
import glob
import os


def load_driving_data(annotations_dir, max_frames=200):
    data = []
    labels = []

    video_dirs = glob.glob(os.path.join(annotations_dir, "*/"))

    for video_dir in video_dirs:
        print(video_dir)
        json_files = glob.glob(os.path.join(video_dir, "*.json"))
        if not json_files:
            print(f"No JSON files found in {video_dir}")
            continue
        video_data = []
        for json_file in json_files:
            try:
                with open(json_file, "r") as f:
                    frame_data = json.load(f)
                    video_data.append(frame_data)
            except json.JSONDecodeError as e:
                print(f"Error decoding JSON in {json_file}: {e}")
                continue
        if video_data:
            data.append(video_data)
            labels.append(np.random.uniform(0, 5))

    return data, labels


def extract_features(frame_data):
    features = []
    features.append(float(frame_data["lane_centering"]["following_lane_discipline"]))
    features.append(frame_data["lane_centering"]["score"])
    safe_distance_encoding = {
        "safe": [1, 0, 0],
        "approximate": [0, 1, 0],
        "unsafe": [0, 0, 1],
    }.get(frame_data["following_distance"]["safe_distance"], [0, 0, 0])
    features.extend(safe_distance_encoding)
    features.append(frame_data["following_distance"]["score"])
    traffic_light_status_encoding = {
        "red": [1, 0, 0],
        "yellow": [0, 1, 0],
        "green": [0, 0, 1],
    }.get(frame_data["signal_compliance"]["traffic_light"]["status"], [0, 0, 0])
    features.extend(traffic_light_status_encoding)
    features.append(
        float(frame_data["signal_compliance"]["traffic_light"]["compliance"])
    )
    features.append(frame_data["signal_compliance"]["traffic_light"]["score"])
    features.append(float(frame_data["signal_compliance"]["stop_sign"]["present"]))
    stop_sign_compliance_encoding = {True: [1, 0], False: [0, 1], "N/A": [0, 0]}.get(
        frame_data["signal_compliance"]["stop_sign"]["compliance"], [0, 0]
    )
    features.extend(stop_sign_compliance_encoding)
    features.append(frame_data["signal_compliance"]["stop_sign"]["score"])
    features.append(
        float(frame_data["road_sign_awareness"]["speed_limit_sign"]["visible"])
    )
    observing_limit_encoding = {
        "observing": [1, 0, 0],
        "exceeding": [0, 1, 0],
        "unknown": [0, 0, 1],
    }.get(
        frame_data["road_sign_awareness"]["speed_limit_sign"]["observing_limit"],
        [0, 0, 0],
    )
    features.extend(observing_limit_encoding)
    features.append(frame_data["road_sign_awareness"]["speed_limit_sign"]["score"])
    features.append(float(frame_data["road_sign_awareness"]["yield_sign"]["visible"]))
    features.append(frame_data["road_sign_awareness"]["yield_sign"]["score"])
    features.append(float(frame_data["shoulder_use"]["using_shoulder"]))
    features.append(frame_data["shoulder_use"]["score"])
    features.append(float(frame_data["merging_lane_change"]["safe_merging"]))
    features.append(frame_data["merging_lane_change"]["score"])
    features.append(float(frame_data["pedestrian_yielding"]["pedestrian_present"]))
    features.append(frame_data["pedestrian_yielding"]["score"])
    features.append(float(frame_data["intersection_behavior"]["stop_line_observance"]))
    features.append(frame_data["intersection_behavior"]["score"])
    return features


annotations_directory = os.path.abspath("../../data/annotations")

driving_data, labels = load_driving_data(annotations_directory)

X = []
for video in driving_data:
    video_features = [extract_features(frame) for frame in video]
    X.append(video_features)

max_frames = max(len(video_features) for video_features in X)

X = keras.preprocessing.sequence.pad_sequences(
    X, maxlen=max_frames, dtype="float32", padding="post", truncating="post"
)

y = np.array(labels)

scaler = StandardScaler()
X_reshaped = X.reshape(-1, X.shape[-1])
X_scaled = scaler.fit_transform(X_reshaped)
X = X_scaled.reshape(X.shape)

X_train, X_temp, y_train, y_temp = train_test_split(
    X, y, test_size=0.3, random_state=42
)
X_val, X_test, y_val, y_test = train_test_split(
    X_temp, y_temp, test_size=0.5, random_state=42
)

model = keras.Sequential()
model.add(
    keras.layers.LSTM(
        units=512,
        return_sequences=True,
        input_shape=(X_train.shape[1], X_train.shape[2]),
    )
)
model.add(keras.layers.Dropout(0.5))
model.add(keras.layers.LSTM(units=256, return_sequences=True))
model.add(keras.layers.Dropout(0.5))
model.add(keras.layers.LSTM(units=128))
model.add(keras.layers.Dropout(0.5))
model.add(keras.layers.Dense(units=128, activation="relu"))
model.add(keras.layers.Dropout(0.5))
model.add(keras.layers.Dense(units=64, activation="relu"))
model.add(keras.layers.Dense(units=1))

model.compile(
    optimizer=tf.keras.optimizers.Adam(learning_rate=0.0005),
    loss="mse",
    metrics=["mae"],
)

early_stopping = keras.callbacks.EarlyStopping(
    monitor="val_loss", patience=10, restore_best_weights=True
)


history = model.fit(
    X_train,
    y_train,
    epochs=100,
    batch_size=128,
    validation_data=(X_val, y_val),
    callbacks=[early_stopping],
)

loss, mae = model.evaluate(X_test, y_test)
print(f"Test Loss: {loss}, Test MAE: {mae}")


model.save("../../models/lstm_model.pt")
