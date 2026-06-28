FROM uapki:latest

# Install C++ build tools and dependencies
RUN apt-get update && apt-get install -y \
    g++ \
    make \
    nlohmann-json3-dev \
    && rm -rf /var/lib/apt/lists/*

# Copy C++ wrapper
COPY uapki_json_wrapper.cpp /app/uapki_json_wrapper.cpp

# Compile the wrapper
RUN g++ -o /app/uapki_wrapper /app/uapki_json_wrapper.cpp \
    -I/usr/include/nlohmann \
    /usr/local/lib/libuapki.so.2 \
    -Wl,-rpath,/usr/local/lib

WORKDIR /app

CMD ["/bin/bash"]
