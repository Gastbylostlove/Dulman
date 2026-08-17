part of 'chat_room_screen.dart';

class _InputBar extends StatelessWidget {
  final TextEditingController ctrl;
  final bool sending;
  final VoidCallback onSend;
  final VoidCallback onMedia;

  const _InputBar({
    required this.ctrl,
    required this.sending,
    required this.onSend,
    required this.onMedia,
  });

  @override
  Widget build(BuildContext context) {
    final shortcuts = <ShortcutActivator, Intent>{
      const SingleActivator(LogicalKeyboardKey.enter):
          const _SendMessageIntent(),
      const SingleActivator(LogicalKeyboardKey.numpadEnter):
          const _SendMessageIntent(),
    };

    return Container(
      color: const Color(0xFF0F0C1C),
      padding: EdgeInsets.only(
        left: 8,
        right: 8,
        top: 8,
        bottom: MediaQuery.of(context).viewInsets.bottom + 8,
      ),
      child: Row(
        children: [
          IconButton(
            onPressed: onMedia,
            icon: const Icon(
              Icons.photo_library_outlined,
              color: Color(0xFFFF5E00),
            ),
          ),
          Expanded(
            child: Shortcuts(
              shortcuts: shortcuts,
              child: Actions(
                actions: {
                  _SendMessageIntent: CallbackAction<_SendMessageIntent>(
                    onInvoke: (_) {
                      if (!sending) onSend();
                      return null;
                    },
                  ),
                },
                child: TextField(
                  controller: ctrl,
                  maxLines: 4,
                  minLines: 1,
                  textInputAction: TextInputAction.send,
                  onSubmitted: (_) => onSend(),
                  decoration: InputDecoration(
                    hintText: '메시지 입력...',
                    hintStyle: const TextStyle(
                      color: Colors.white38,
                      fontSize: 14,
                    ),
                    filled: true,
                    fillColor: const Color(0xFF1E1830),
                    border: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(22),
                      borderSide: BorderSide.none,
                    ),
                    contentPadding: const EdgeInsets.symmetric(
                      horizontal: 16,
                      vertical: 10,
                    ),
                  ),
                ),
              ),
            ),
          ),
          const SizedBox(width: 6),
          sending
              ? const Padding(
                  padding: EdgeInsets.all(12),
                  child: SizedBox(
                    width: 20,
                    height: 20,
                    child: CircularProgressIndicator(
                      strokeWidth: 2,
                      color: Color(0xFFFF5E00),
                    ),
                  ),
                )
              : IconButton(
                  onPressed: onSend,
                  icon: const Icon(
                    Icons.send_rounded,
                    color: Color(0xFFFF5E00),
                  ),
                ),
        ],
      ),
    );
  }
}

class _SendMessageIntent extends Intent {
  const _SendMessageIntent();
}

// ─── 미디어 권한 선택 시트 ───────────────────────────────────────────────────────

class _PermissionPicker extends StatelessWidget {
  const _PermissionPicker();

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(20, 16, 20, 32),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text(
            '열람 권한 선택',
            style: TextStyle(fontSize: 16, fontWeight: FontWeight.w700),
          ),
          const SizedBox(height: 4),
          const Text(
            '선택한 권한은 이 메시지의 모든 미디어에 적용됩니다.',
            style: TextStyle(fontSize: 12, color: Colors.grey),
          ),
          const SizedBox(height: 20),
          _PermItem(
            label: '일회용',
            icon: Icons.looks_one_rounded,
            description: '1회 열람 후 자동 차단 · 다운로드/캡처 불가',
            value: 'once',
            color: const Color(0xFFB71C1C),
          ),
          const SizedBox(height: 10),
          _PermItem(
            label: '다시보기',
            icon: Icons.replay_circle_filled_rounded,
            description: '2회 열람 가능 · 다운로드/캡처 불가',
            value: 'replay_once',
            color: const Color(0xFFE65100),
          ),
          const SizedBox(height: 10),
          _PermItem(
            label: '보관',
            icon: Icons.lock_open_rounded,
            description: '무제한 열람 · 다운로드/캡처 가능',
            value: 'keep',
            color: const Color(0xFF2E7D32),
          ),
        ],
      ),
    );
  }
}

class _PermItem extends StatelessWidget {
  final String label;
  final IconData icon;
  final String description;
  final String value;
  final Color color;

  const _PermItem({
    required this.label,
    required this.icon,
    required this.description,
    required this.value,
    required this.color,
  });

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: () => Navigator.pop(context, value),
      borderRadius: BorderRadius.circular(14),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
        decoration: BoxDecoration(
          color: color.withOpacity(0.10),
          borderRadius: BorderRadius.circular(14),
          border: Border.all(color: color.withOpacity(0.28)),
        ),
        child: Row(
          children: [
            Icon(icon, color: color, size: 24),
            const SizedBox(width: 14),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    label,
                    style: TextStyle(fontWeight: FontWeight.w700, color: color),
                  ),
                  const SizedBox(height: 2),
                  Text(
                    description,
                    style: const TextStyle(fontSize: 12, color: Colors.white54),
                  ),
                ],
              ),
            ),
            Icon(Icons.chevron_right, color: color.withOpacity(0.5)),
          ],
        ),
      ),
    );
  }
}
