docker run -d \
  --name qdrant \
  -p 6333:6333 \
  -p 6334:6334 \
  -v /home/share/qdrant_storage:/qdrant/storage \
  qdrant/qdrant:latest