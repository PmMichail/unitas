FROM ubuntu:22.04

# Install dependencies
RUN apt-get update && apt-get install -y \
    libssl-dev \
    libcurl4-openssl-dev \
    wget \
    && rm -rf /var/lib/apt/lists/*

# Copy UAPKI libraries
COPY uapki-v2.0.12-linux-amd64/ /usr/local/lib/

# Create symlinks for library loading
RUN ln -sf /usr/local/lib/libuapki.so.2.0.12 /usr/local/lib/libuapki.so.2 && \
    ln -sf /usr/local/lib/libuapkic.so.2.0.1 /usr/local/lib/libuapkic.so.2 && \
    ln -sf /usr/local/lib/libuapkif.so.2.0.1 /usr/local/lib/libuapkif.so.2 && \
    ln -sf /usr/local/lib/libcm-pkcs12.so.1.0.13 /usr/local/lib/libcm-pkcs12.so.1 && \
    ln -sf /usr/local/lib/libcm-pkcs12.so.1.0.13 /usr/local/lib/libcm-pkcs12.so

# Update library cache
RUN ldconfig

# Set working directory
WORKDIR /app

# Expose port for JSON interface
EXPOSE 8080

# Run UAPKI test application (will be replaced with actual service)
CMD ["/bin/bash"]
