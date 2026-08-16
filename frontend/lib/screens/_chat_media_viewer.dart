part of 'chat_room_screen.dart';

class _MediaViewerScreen extends StatefulWidget {
  final List<String> mediaUrls;
  final List<String> mimeTypes;
  final int initialIndex;
  final String permissionLabel;

  const _MediaViewerScreen({
    required this.mediaUrls,
    required this.mimeTypes,
    required this.initialIndex,
    required this.permissionLabel,
  });

  @override
  State<_MediaViewerScreen> createState() => _MediaViewerScreenState();
}

class _MediaViewerScreenState extends State<_MediaViewerScreen> {
  late final PageController _pageController;
  int _currentIndex = 0;

  @override
  void initState() {
    super.initState();
    _currentIndex = widget.initialIndex;
    _pageController = PageController(initialPage: widget.initialIndex);
  }

  @override
  void dispose() {
    _pageController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.black,
      body: SafeArea(
        child: Stack(
          children: [
            Positioned.fill(
              child: PageView.builder(
                controller: _pageController,
                itemCount: widget.mediaUrls.length,
                onPageChanged: (value) => setState(() => _currentIndex = value),
                itemBuilder: (_, index) {
                  final mime = index < widget.mimeTypes.length
                      ? widget.mimeTypes[index]
                      : 'image/jpeg';
                  if (mime.startsWith('video/')) {
                    return _VideoPage(url: widget.mediaUrls[index]);
                  }
                  return Center(
                    child: InteractiveViewer(
                      minScale: 1,
                      maxScale: 4,
                      child: Image.network(
                        widget.mediaUrls[index],
                        fit: BoxFit.contain,
                        errorBuilder: (context, error, stack) {
                          Log.e(
                            'IMAGE',
                            '전체화면 이미지 로드 실패: ${widget.mediaUrls[index]}',
                            error,
                            stack,
                          );
                          return const Icon(
                            Icons.broken_image,
                            color: Colors.white54,
                            size: 56,
                          );
                        },
                      ),
                    ),
                  );
                },
              ),
            ),
            Positioned(
              top: 12,
              left: 12,
              right: 12,
              child: Row(
                children: [
                  Material(
                    color: Colors.black.withValues(alpha: 0.45),
                    borderRadius: BorderRadius.circular(999),
                    child: InkWell(
                      onTap: () => Navigator.of(context).pop(),
                      borderRadius: BorderRadius.circular(999),
                      child: const Padding(
                        padding: EdgeInsets.symmetric(
                          horizontal: 12,
                          vertical: 10,
                        ),
                        child: Row(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            Icon(
                              Icons.arrow_back_rounded,
                              color: Colors.white,
                              size: 18,
                            ),
                            SizedBox(width: 4),
                            Text(
                              '뒤로',
                              style: TextStyle(
                                color: Colors.white,
                                fontSize: 13,
                                fontWeight: FontWeight.w700,
                              ),
                            ),
                          ],
                        ),
                      ),
                    ),
                  ),
                  const SizedBox(width: 4),
                  Expanded(
                    child: Text(
                      widget.permissionLabel,
                      style: const TextStyle(
                        color: Colors.white,
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                  ),
                  if (widget.mediaUrls.length > 1)
                    Text(
                      '${_currentIndex + 1}/${widget.mediaUrls.length}',
                      style: const TextStyle(color: Colors.white70),
                    ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

// ─── 동영상 플레이어 페이지 ──────────────────────────────────────────────────────

class _VideoPage extends StatefulWidget {
  final String url;

  const _VideoPage({required this.url});

  @override
  State<_VideoPage> createState() => _VideoPageState();
}

class _VideoPageState extends State<_VideoPage> {
  late final VideoPlayerController _ctrl;
  bool _initialized = false;
  bool _hasError = false;

  @override
  void initState() {
    super.initState();
    _ctrl = VideoPlayerController.networkUrl(Uri.parse(widget.url))
      ..initialize().then((_) {
        if (mounted) setState(() => _initialized = true);
      }).catchError((e) {
        Log.e('VIDEO', '동영상 초기화 실패: ${widget.url}', e);
        if (mounted) setState(() => _hasError = true);
      });
  }

  @override
  void dispose() {
    _ctrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    if (_hasError) {
      return const Center(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(Icons.videocam_off_rounded, color: Colors.white54, size: 48),
            SizedBox(height: 12),
            Text(
              '동영상을 재생할 수 없습니다.',
              style: TextStyle(color: Colors.white54, fontSize: 14),
            ),
          ],
        ),
      );
    }
    if (!_initialized) {
      return const Center(
        child: CircularProgressIndicator(color: Colors.white),
      );
    }
    return Center(
      child: AspectRatio(
        aspectRatio: _ctrl.value.aspectRatio,
        child: GestureDetector(
          onTap: () => setState(() {
            _ctrl.value.isPlaying ? _ctrl.pause() : _ctrl.play();
          }),
          child: Stack(
            alignment: Alignment.center,
            children: [
              VideoPlayer(_ctrl),
              if (!_ctrl.value.isPlaying)
                const Icon(
                  Icons.play_circle_filled,
                  color: Colors.white70,
                  size: 64,
                ),
            ],
          ),
        ),
      ),
    );
  }
}

// ─── 미디어 타입 선택 시트 ──────────────────────────────────────────────────────

class _MediaTypePicker extends StatelessWidget {
  const _MediaTypePicker();

  @override
  Widget build(BuildContext context) {
    return SafeArea(
      child: Padding(
        padding: const EdgeInsets.symmetric(vertical: 8),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            ListTile(
              leading: const Icon(Icons.photo_rounded, color: Color(0xFFBE4B51)),
              title: const Text('사진'),
              onTap: () => Navigator.pop(context, 'photo'),
            ),
            ListTile(
              leading:
                  const Icon(Icons.videocam_rounded, color: Color(0xFFBE4B51)),
              title: const Text('동영상'),
              onTap: () => Navigator.pop(context, 'video'),
            ),
          ],
        ),
      ),
    );
  }
}
