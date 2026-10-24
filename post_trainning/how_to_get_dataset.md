mkdir downloaded_dataset
Invoke-WebRequest -Uri "https://github.com/ultralytics/assets/releases/download/v0.0.0/coco128.zip" -OutFile downloaded_dataset\coco128.zip
Expand-Archive downloaded_dataset\coco128.zip -DestinationPath downloaded_dataset


python convert_dataset.py downloaded_dataset/coco128/images


python backend.py --annotate annotated