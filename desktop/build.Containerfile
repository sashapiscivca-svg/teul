# The desktop build machine: Tauri v2 for Linux (.deb, .AppImage) and, crossed with cargo-xwin, for Windows (NSIS).
# Built and used by desktop/build-in-container.sh (podman or docker, no root needed on the host).
FROM docker.io/library/debian:trixie

ENV DEBIAN_FRONTEND=noninteractive
RUN apt-get update && apt-get install -y --no-install-recommends \
      ca-certificates curl wget file git build-essential pkg-config xdg-utils \
      libwebkit2gtk-4.1-dev libxdo-dev libssl-dev libayatana-appindicator3-dev librsvg2-dev libdbus-1-dev \
      gstreamer1.0-plugins-base gstreamer1.0-plugins-good gstreamer1.0-libav \
      nodejs npm \
      clang lld llvm nsis \
    && rm -rf /var/lib/apt/lists/*

# Windows' tools under the names cargo-xwin looks for
RUN for t in clang-cl lld-link llvm-lib llvm-rc llvm-dlltool; do \
      [ -e /usr/bin/$t ] || ln -s "$(ls /usr/lib/llvm-*/bin/$t | sort -V | tail -1)" /usr/bin/$t; done

ENV RUSTUP_HOME=/opt/rustup CARGO_HOME=/opt/cargo PATH=/opt/cargo/bin:$PATH
RUN curl -sSf https://sh.rustup.rs | sh -s -- -y --profile minimal --default-toolchain 1.99.0 \
    && rustup target add x86_64-pc-windows-msvc \
    && cargo install --locked cargo-xwin@0.23.1 \
    && rm -rf /opt/cargo/registry /opt/cargo/git

# linuxdeploy's GStreamer plugin (sound in the AppImage) needs patchelf
RUN apt-get update && apt-get install -y --no-install-recommends patchelf && rm -rf /var/lib/apt/lists/*
