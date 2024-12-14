
**1.1. Project Name:**  Driving Behavior Analysis System (DBAS)

**1.2. Project Goal:** To develop a system that automatically analyzes driving behavior from YouTube videos, providing detailed metrics and scores on various driving aspects.

**1.3. Core Functionality:**

*   Download YouTube videos of cars.
*   Extract video frames at 1 frame per second (FPS).
*   Analyze each frame using a fine-tuned Large Language Model (LLM) to extract driving behavior data.
*   Perform sequential analysis of the extracted data using a Long Short-Term Memory (LSTM) network.
*   Provide a user interface for video upload and results visualization.

**1.4. Key Technologies:**

*   **Backend:**
    *   **Database:** Postgres on Neon.Tech
    *   **Orchestration and Deployment:** Kubernetes (K8s)
    *   **API Framework:** Rust (Actix Web, Actix Multipart, Tonic)
    *   **Sequential Analysis:** C++ (LSTM Implementation)
    *   **gRPC:** for communication between rust server and VMs
*   **Machine Learning:**
    *   **LLM:** Fine-tuned LLAMA 3 2.1 11B Vision QLORA model (using LLaMA-Factory)
    *   **LLM Framework:**  LLaMA-Factory (GitHub library)
    *   **Computer Vision:** Anthropic Claude 3.5 Sonnet (for initial data annotation and schema generation)
*   **Frontend:**
    *   **Framework:** Rsbuild, React
    *   **Styling:** Tailwind CSS, ShadCN UI
*   **Video Processing:**
    *   **Video Downloading:** savefrom, ytdl (Python)
    *   **Frame Extraction:** ffmpeg (Typescript)

**2. System Architecture**

The system follows a microservices architecture, with different components responsible for specific tasks. The primary components are:

**2.1. Video Downloader (Python)**

*   **Responsibility:** Downloads YouTube videos based on user input (URL).
*   **Technology:**  Python, savefrom/ytdl
*   **Input:** YouTube video URL
*   **Output:** Downloaded video file (stored temporarily, location passed to the next component)
*   **Deployment:** K8s
*   **Details:**
    *   Utilizes either `savefrom` or `ytdl` libraries to fetch video files from YouTube.
    *   Handles potential errors like invalid URLs or network issues.
    *   Stores the downloaded video in a designated storage location (e.g., shared storage accessible by other services).
    *   Sends the video file path to the Frame Extractor service.

**2.2. Frame Extractor (Typescript, ffmpeg)**

*   **Responsibility:** Extracts frames from the downloaded video at a rate of 1 FPS.
*   **Technology:** Typescript, ffmpeg
*   **Input:** Downloaded video file path
*   **Output:** Sequence of image files (frames), each representing one second of the video, and video metadata such as total number of frames in the video.
*   **Deployment:** K8s
*   **Details:**
    *   Uses `ffmpeg` to efficiently extract frames.
    *   Names frames sequentially (e.g., frame\_0001.jpg, frame\_0002.jpg) for easy processing.
    *   Resizes the frames to 576p.
    *   Stores the extracted frames in a location accessible by the backend API.
    *   Sends the frame paths and metadata of the video to the Rust backend.

**2.3. Rust Backend API (Rust: Actix Web, Actix Multipart, Tonic, gRPC)**

*   **Responsibility:** Orchestrates the analysis process, manages communication between services, handles data storage and retrieval.
*   **Technology:** Rust, Actix Web, Actix Multipart, Tonic, gRPC, Postgres (Neon.Tech)
*   **Input:**
    *   Video metadata and frames from the Frame Extractor
    *   Analysis requests from the Frontend
*   **Output:**
    *   Processed driving behavior data to the Frontend
    *   Status updates to the Frontend
*   **Deployment:** K8s, Postgres on Neon.Tech
*   **Details:**
    *   **API Endpoints:**
        *   `/upload`: Accepts video file via multipart/form-data.
        *   `/analyze`: Accepts the request to start processing the uploaded video
        *   `/results/{video_id}`: Retrieves analysis results for a given video.
    *   **Orchestration:**
        *   Divides the sequence of frames into batches.
        *   Distributes frame batches to available VM instances using a gRPC-based protocol.
        *   Monitors VM resource utilization (CPU, memory) to optimize frame distribution.
        *   Aggregates results from VMs.
        *   Passes aggregated data to the LSTM component for sequential analysis.
    *   **Database Interaction (Postgres):**
        *   Stores video metadata.
        *   Stores raw analysis data from the LLM.
        *   Stores processed results from the LSTM.
        *   Manages user accounts (if applicable).
    *   **gRPC Communication:**
        *   Defines a gRPC service for communication with VMs.
        *   Sends frames to VMs for processing.
        *   Receives processed frame data from VMs.
    *   **Error Handling:**
        *   Handles potential errors from VMs, such as model failures or timeouts.
        *   Implements retry mechanisms for failed frame processing.

**2.4. Virtual Machine (VM) Pool (Python, Fine-tuned LLM, gRPC)**

*   **Responsibility:** Runs the fine-tuned LLM to analyze individual video frames.
*   **Technology:** Python, Fine-tuned LLAMA 3 2.1 11B Vision QLORA model, LLaMA-Factory, gRPC
*   **Input:** Video frame (image) via gRPC
*   **Output:** JSON object containing driving behavior data for the frame, sent back via gRPC
*   **Deployment:** K8s (each VM runs as a separate pod)
*   **Details:**
    *   Each VM runs a Python application that hosts the fine-tuned LLM.
    *   Implements a gRPC server to receive frames from the Rust backend.
    *   Loads the LLM model on startup.
    *   Processes each received frame using the LLM to generate the defined JSON output based on the schema described in the prompt:

        ```json
        {
          "lane_centering": {
            "following_lane_discipline": true, // or false
            "score": 18 // Example score
          },
          "following_distance": {
            "safe_distance": "Safe", // Example assessment
            "score": 12
          },
          // ... other attributes as per the schema
        }
        ```
    *   Sends the JSON output back to the Rust backend via gRPC.
    *   **Intermediate Data Extracted by the LLM:**
        *   **Steering Angle:** Estimated steering angle of the vehicle.
        *   **Distance to Objects:**  Distances to surrounding vehicles, pedestrians, and other objects.
        *   **Lane Position:** Relative position of the vehicle within the lane.
        *   **Speed:** Estimated speed of the vehicle.
        *   **Presence and Status of Traffic Signals:**  Detects traffic lights (red, yellow, green) and stop signs.
        *   **Presence of Pedestrians:** Detects pedestrians near the vehicle.
        *   **Indicator Usage:** Detects whether turn signals are used.
        *   **Road Type:**  Identifies highway, city street, residential area, etc.
        *   **Weather Conditions:**  Estimates weather conditions (clear, rainy, snowy, etc.).
        *   **Time of Day:** Determines if it's day or night.
        *   **Presence of Road Markings:** Detects lane markings, crosswalks, etc.
        *   **Vehicle's Trajectory:** Predicts the vehicle's path in the next few seconds.
        *   **Aggressive/Defensive Driving:** Classifies driving style based on multiple factors.
    *   **Error Handling:**
        *   Handles model inference errors gracefully.
        *   Sends error messages back to the Rust backend.

**2.5. LSTM Sequential Analyzer (C++)**

*   **Responsibility:** Analyzes the sequence of frame-level data to identify patterns and generate overall driving behavior metrics.
*   **Technology:** C++
*   **Input:** Sequence of JSON objects (one per frame) from the Rust backend
*   **Output:** Overall driving behavior scores and analysis report
*   **Deployment:** K8s
*   **Details:**
    *   Receives the aggregated frame-level data from the Rust backend.
    *   Uses an LSTM model to analyze the temporal relationships between frames.
    *   Identifies patterns like:
        *   Consistency of lane keeping.
        *   Smoothness of acceleration and braking.
        *   Appropriate following distances over time.
        *   Proper reactions to traffic signals and road signs.
        *   Overall driving style (aggressive, cautious, etc.).
    *   Generates overall scores for each driving aspect based on the LSTM analysis.
    *   Creates a comprehensive report summarizing the driving behavior.
    *   Sends the report and scores back to the Rust backend.

**2.6. Frontend (Rsbuild, React, Tailwind CSS, ShadCN UI)**

*   **Responsibility:** Provides the user interface for video upload, analysis initiation, and results visualization.
*   **Technology:** Rsbuild, React, Tailwind CSS, ShadCN UI
*   **Input:** User interactions (video upload, analysis requests)
*   **Output:** UI elements, visualizations of driving analysis results
*   **Deployment:** K8s
*   **Details:**
    *   **Video Upload:**
        *   Allows users to upload video files.
        *   Sends the video file to the Rust backend using a multipart/form-data POST request.
    *   **Analysis Initiation:**
        *   Provides a button or similar UI element to trigger the analysis process.
        *   Sends an analysis request to the Rust backend.
    *   **Results Visualization:**
        *   Displays the analysis results in a user-friendly format.
        *   Uses charts, graphs, and tables to present the data.
        *   Highlights key driving events and scores.
        *   May provide a video playback feature with synchronized annotations.

**3. Data Model (Postgres)**

The database will store the following information:

*   **Videos:**
    *   `video_id` (UUID, Primary Key)
    *   `youtube_url` (TEXT, Unique)
    *   `file_path` (TEXT)
    *   `total_frames` (INTEGER)
    *   `processing_status` (ENUM: 'queued', 'processing', 'completed', 'failed')
    *   `upload_timestamp` (TIMESTAMP)
*   **Frames:**
    *   `frame_id` (UUID, Primary Key)
    *   `video_id` (UUID, Foreign Key referencing Videos)
    *   `frame_number` (INTEGER)
    *   `file_path` (TEXT)
    *   `raw_analysis_data` (JSONB) - Stores the raw JSON output from the LLM
*   **AnalysisResults:**
    *   `result_id` (UUID, Primary Key)
    *   `video_id` (UUID, Foreign Key referencing Videos)
    *   `lstm_analysis_data` (JSONB) - Stores the processed data from the LSTM
    *   `overall_score` (INTEGER) - Overall driving score
    *   `lane_keeping_score` (INTEGER)
    *   `following_distance_score` (INTEGER)
    *   `speed_management_score` (INTEGER)
    *   `traffic_signal_compliance_score` (INTEGER)
    *   `... (other scores as needed)`
    *   `analysis_timestamp` (TIMESTAMP)

**4. LLM Fine-tuning (LLaMA-Factory)**

*   **Model:** LLAMA 3 2.1 11B Vision QLORA
*   **Framework:** LLaMA-Factory
*   **Dataset:** Curated dataset of driving videos annotated with the schema defined in the prompt, along with the intermediate data points mentioned earlier (steering angle, distances, etc.).
*   **Fine-tuning Process:**
    1. **Data Preparation (Saniya):**
        *   Collect a large dataset of driving videos from various sources.
        *   Use Anthropic Claude 3.5 Sonnet to generate initial annotations based on the defined schema and intermediate data points for each frame.
        *   Manually review and correct the annotations generated by Claude.
        *   Format the data into a format compatible with LLaMA-Factory.
    2. **Fine-tuning (Aditya):**
        *   Use LLaMA-Factory to fine-tune the LLAMA 3 2.1 11B Vision QLORA model on the prepared dataset.
        *   Experiment with different hyperparameters and training settings to optimize model performance.
        *   Use techniques like LoRA (Low-Rank Adaptation) to reduce the computational cost of fine-tuning.
    3. **Evaluation:**
        *   Evaluate the fine-tuned model on a held-out test set.
        *   Use metrics like precision, recall, F1-score, and accuracy to assess model performance.
        *   Iteratively improve the model by adjusting the dataset, hyperparameters, or training process.

**5. Team Responsibilities**

*   **Saniya:** Data Preparation and Pre-processing
    *   Collecting and curating the driving video dataset.
    *   Generating initial annotations using Anthropic Claude.
    *   Manual annotation and correction.
    *   Data formatting for LLaMA-Factory.
*   **Aditya:** LLM Fine-tuning
    *   Setting up the LLaMA-Factory environment.
    *   Fine-tuning the LLAMA model.
    *   Hyperparameter optimization.
    *   Model evaluation.
*   **Suryavir:** Backend Development, LSTM, and Deployment
    *   Developing the Rust backend API.
    *   Implementing the LSTM model in C++.
    *   Setting up gRPC communication.
    *   Orchestrating the analysis pipeline.
    *   Deploying the system on Kubernetes.
    *   Database design and management.

**6. Development Process**

1. **Requirements Gathering and Design:** (Completed - this document)
2. **Data Preparation and Annotation:** Saniya prepares the dataset and generates initial annotations.
3. **LLM Fine-tuning:** Aditya fine-tunes the LLM using LLaMA-Factory.
4. **Backend Development:** Suryavir develops the Rust backend, LSTM, and gRPC communication.
5. **Frontend Development:** Develop the frontend using Rsbuild, React, Tailwind CSS, and ShadCN UI.
6. **Integration and Testing:** Integrate all components and conduct thorough testing.
7. **Deployment:** Deploy the system on Kubernetes and Neon.Tech.
8. **Monitoring and Maintenance:** Monitor system performance and address any issues that arise.

**7. Future Enhancements**

*   **Real-time Analysis:**  Adapt the system to process live video streams.
*   **Driver Identification:**  Incorporate driver identification features to track individual driver behavior.
*   **Advanced Metrics:** Develop more sophisticated metrics to assess driving skills.
*   **Integration with Driving Simulators:** Integrate the system with driving simulators for training and evaluation purposes.
*   **Support for other LLMs and training frameworks:**  Make the system modular and adaptable.

