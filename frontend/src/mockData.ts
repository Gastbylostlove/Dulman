import { Message, PhotoAsset } from "./types";

export const initialMessages: Message[] = [
  {
    id: "m1",
    sender: "me",
    text: "우리 오늘 저녁 뭐 먹을까?",
    time: "오후 6:30",
  },
  {
    id: "m2",
    sender: "partner",
    text: "맛있는 거 먹자! 사진 하나 보내줄게",
    time: "오후 6:32",
  },
  {
    id: "m3",
    sender: "partner",
    time: "오후 6:33",
    isMedia: true,
    mediaUrl: "https://lh3.googleusercontent.com/aida-public/AB6AXuB3zICJgsJG6dYw69Dy5N1QMgnZ2GeLkOlZNKWkHTxnkTF-DK3nWqoogUtmZNYtfM-z3slGFAjw3I8DyTfHtpbmkEHmUA33svswXL0bGHnvQdSlQk9eldg_Hv9aAX1nVTCffSXktrkrHRgEOFQ8SYgBkVZyePYjS8eed0MZ2_xXQsURrBFtEaoGb_W5wWrFGZHaJMA8SH1fyULqPRYStKdcdaL_hS-mxONzw8amVlvAt7VO08_2PaFwQ0OuwHyBXOrBIVOpXp5ArOwb",
    permissionType: "once",
    revealed: false,
    clicksCount: 0,
  }
];

export const photoGallery: PhotoAsset[] = [
  {
    id: "p1",
    url: "https://lh3.googleusercontent.com/aida-public/AB6AXuB5NyChIL9fi30KgPWWzKoex7aIsr5Cm6lisKNlgM8K4_UtSufnjx8yFKdYaim7c-MzjDgg62V6sVhk6Nkfohr-6zyEz8brJ1JzD5iNvw02MLDhP2n5jsgqR14xa6L6Id78A--z04dkFN9FW_q797NclKoyjDTZALV3hvIi--P8X9-wauNHdYkZ7aYnaRZaILkgwIprHxE__jfZCctv-JOYe50kbjcF1h0zWcA3nNTjggZfRXGn-KP1u6d2swtRcGAZKEqcHRgx4j7q",
    alt: "Intertwined Hands"
  },
  {
    id: "p2",
    url: "https://lh3.googleusercontent.com/aida-public/AB6AXuBpL6FecfbMH2KZgbKQONfE_sLXG8WvA8ji2o-AyUz4TK9TnfadIlor2uuQuwoUZxLWUzr3D8mwvImwAXPbpMYvimZ-7R9GTMCtK3uEFi3mWBzmvTQHEsawRiC0hT7JlPcivs2rD2PN0-p2Ct2Fdu5Xb_f0TlpiXhERINSeEQ0lX_4Wx6njUzUkj2OzWFbnUnmLZhsVzXJgPAz30DgjjjYFX3UfwrhD6_t65Xe-W82bMdPAX4VwSbUZVpuWLqH9-JkCO0U9XfzDZYSZ",
    alt: "Coffee & Journal"
  },
  {
    id: "p3",
    url: "https://lh3.googleusercontent.com/aida-public/AB6AXuC3asPI_XzaeOMUtqma_rnquxVmxJ4lU3Vn4u1Kgn-vc_Qgju4xtWcFWfwm0_u6_qAa7cR-_NrOEYLB26CK-SCv6v0gH5_PbAHrf-bpzLW3RxZa0luGGc0-v67J6HWfVTajdD9enUpK0SbpWTZeomNXmtHgqq0iMZOtS7JXt5_q5Jn0uR8tA9O6KyJSNDSa2ywk8AKGh0EoTGuNLvR5GD5G0wxe0g9r_YevS0qusK-A3wAropDTLdjHN8RaHWCmQ-KkUW1VkDG2TqO0",
    alt: "Wind curtains blowing"
  },
  {
    id: "p4",
    url: "https://lh3.googleusercontent.com/aida-public/AB6AXuCcfWE6ByNo9MM22UuwCzY01P-b_y3jzML4tEPbYtOJsfJPzswGWUTW7TJ4KzfcNHz8ohpD_H_6FN8ULzqM_L1l6XNh8gbMhBKXMTxxmTlNR5v9QXstrjWO1suf2Uo_F7dDMRE_rtZgTRn-0ffM-OvEonH7VD_CBZxkjIyU0EizTdQhUr_ukzcktHCqpuODdEJExZi23TPJzE9y-f7rJ0SwKSF8jXeHokHMI_n4p_F3zPWqu5cjV9WSyqz6SIoL5W-poJBbPe4vN7_C",
    alt: "Blush flower petals"
  },
  {
    id: "p5",
    url: "https://lh3.googleusercontent.com/aida-public/AB6AXuBHMaBUErFpsf3J_1PplcvBZKoPO2s5mm6eSYgVCPxvXRwL3fPgRICS9sdmzpbq8vOCKoDCC2sWGDVsp4oPFIyRegJnjFY9_0zZJyBnm8otOBIaj-ZM0rFhTXs6midTAF-Gdv5UTTWsIoxYFgDax0LOXVaOpkPf5dgaTo7NAKFRaTvadeP2grMuu5r8J0Z6W65G2bE5bRoht-fc2LaQi4_oGeZ2W-9g4P9OMNo-ufJZj7_tQSkZPTZuMwoQI104LueG078XhjxQd2eY",
    alt: "Cozy table lamp"
  },
  {
    id: "p6",
    url: "https://lh3.googleusercontent.com/aida-public/AB6AXuAuXPQPumeozl9wwVG16fxE9EkSqvlnhsyvvOxSwcgKyXNDiwhuXKMIZcxWb6te4Ng9Nawk7u8n_PRUP3kIrdUkHA98hERks9pFThKx-aY0lftK6FvOMCo2fQGmJtyzsXzkhfiZjnRGOxZ8e9sgWucP9JwrazhNo1PU88TEmHwijPCpf_OHQoU5pLdy7ELfrJsrsWtSJlc2nNm2QdUvwmy_HHLMEaeHIMmZ5N-Q8OVo5H06V5UwXc2UIGrr8zADG9CSjyG__m7eq1ML",
    alt: "Bedroom blankets close"
  },
  {
    id: "p7",
    url: "https://lh3.googleusercontent.com/aida-public/AB6AXuD7XBQCtlXcUBJSQtMItZQurppDFOMwaAx829z5osIixd22Up5hPOSiELvpLM7DvAkOotWpzLDOdTCGKtlcAF4vuR-QpLFwXjdrrtNy7MnXHCyeHhst7sB7vIV7j2jKxAqt61L8yvGVRcLOQB1y9q-cDPio8jUgYvDEcsSHEIrSan4QG3wZCOOOIyOmo5dN47eWkn5GsXwn2C8qPLPOOSfFHvtYJTK3JmXySNpCfqe1ntIb2YRY2Ywtr3UwanMdP_zgY6htUjzRPLeq",
    alt: "Hands holding closed book"
  },
  {
    id: "p8",
    url: "https://lh3.googleusercontent.com/aida-public/AB6AXuDOkZeJqgOXo0baZSMNflenoNqLu--xh5T_HaP46ASuUYeTf_fz9Vgdv7zUwKiZsCn9ieuw4HQGXAar-mo2Pvc6O36amoYE8Y6OaR2C0LAOtzWEsrYqmsar9I_LhuI1h75sTuEMbBSGKJazurWuHfbbEox9L9AXNmenuHv_I4NM9VCl8yDH1CGCwWm-NmjpeLVeaL6ZI7pVg0UXMzuDjlUu0WkLVb4GXv6mYSYpc3QX1rva2-qC9xly1KRW1elZuKT_jv8198HD0kkc",
    alt: "Glasses and dried leaf"
  },
  {
    id: "p9",
    url: "https://lh3.googleusercontent.com/aida-public/AB6AXuAtklWJzS0yJNvvI36daBQecTnLKVUNFXE28KpZnyNlANWHnJtyEJ-3k4JI96V-Rr3Jg3rqZLUdDT5rSpM8rFfD8LZmcF9FQxUYPX6L_WCAgUK-kIP2-bf1oOVK13PsvpcnE_O3SngjqqRv5zPkfug9MkT7uxC3qMEvDsgakQKu23OX6f6ti4ply60zRADP_7XayL34OgVCjIIj3MlwLMgW7ypWILlRr_o6Q5Bs7T2UUhSzGXjzIyNEF4EeMpEU7x7CEdVN3goRV2Gs",
    alt: "Warm mug held by hand"
  }
];

export const flutterSnippets = {
  theme: `// SecureCouple App Theme Configuration (si_theme.dart)
import 'package:flutter/material.dart';

class SecureCoupleTheme {
  // Romantic Core Colors
  static const Color primary = Color(0xFFAE2F34);
  static const Color primaryContainer = Color(0xFFFF6B6B);
  static const Color onPrimary = Color(0xFFFFFFFF);
  static const Color onPrimaryContainer = Color(0xFF6D0010);

  // Security Shell Configuration
  static const Color secondary = Color(0xFF565F6C);
  static const Color onSecondaryFixed = Color(0xFF131C27);
  static const Color securityIndigo = Color(0xFF1C2331);

  // Soft Canvas Backgrounds
  static const Color background = Color(0xFFFCF9F8);
  static const Color surfaceDim = Color(0xFFDCD9D9);
  static const Color surfaceContainer = Color(0xFFF0EDED);
  static const Color canvasCream = Color(0xFFF5F0EA);

  static ThemeData get lightTheme {
    return ThemeData(
      useMaterial3: true,
      scaffoldBackgroundColor: background,
      colorScheme: const ColorScheme.light(
        primary: primary,
        secondary: secondary,
        surface: background,
        error: Color(0xFFBA1A1A),
      ),
      textTheme: const TextTheme(
        displayLarge: TextStyle(
          fontFamily: 'Inter',
          fontSize: 32,
          fontWeight: FontWeight.bold,
          letterSpacing: -0.02,
        ),
        headlineMedium: TextStyle(
          fontFamily: 'Inter',
          fontSize: 24,
          fontWeight: FontWeight.w600,
          letterSpacing: -0.01,
        ),
        bodyLarge: TextStyle(
          fontFamily: 'Inter',
          fontSize: 17,
          fontWeight: FontWeight.normal,
        ),
      ),
    );
  }
}`,
  blurShield: `// Custom Double Blur Shield for Secure Media (blur_shield_message.dart)
import 'dart:ui';
import 'package:flutter/material.dart';

class SecureMediaBubble extends StatefulWidget {
  final String mediaUrl;
  final String durationLabel;
  final VoidCallback onDismiss;

  const SecureMediaBubble({
    super.key,
    required this.mediaUrl,
    required this.durationLabel,
    required this.onDismiss,
  });

  @override
  State<SecureMediaBubble> createState() => _SecureMediaBubbleState();
}

class _SecureMediaBubbleState extends State<SecureMediaBubble> {
  bool _isRevealed = false;

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onLongPressStart: (_) => setState(() => _isRevealed = true),
      onLongPressEnd: (_) {
        setState(() => _isRevealed = false);
        _showDestructiveViewerDialog();
      },
      child: Container(
        width: 240,
        height: 180,
        decoration: BoxDecoration(
          color: const Color(0xFF1C2331),
          borderRadius: BorderRadius.circular(16),
        ),
        clipBehavior: Clip.antiAlias,
        child: Stack(
          children: [
            // Underlying private photo
            Image.network(
              widget.mediaUrl,
              width: double.infinity,
              height: double.infinity,
              fit: BoxFit.cover,
            ),
            // Blur overlay (disappears on active press hold)
            if (!_isRevealed)
              Positioned.fill(
                child: BackdropFilter(
                  filter: ImageFilter.blur(sigmaX: 20.0, sigmaY: 20.0),
                  child: Container(
                    color: Colors.black.withOpacity(0.4),
                    padding: const EdgeInsets.all(16),
                    child: Column(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        const Icon(
                          Icons.timer_outlined,
                          color: Color(0xFFFFA9A6),
                          size: 32,
                        ),
                        const SizedBox(height: 8),
                        Text(
                          '열람 전 일회용 미디어',
                          style: TextStyle(
                            color: const Color(0xFFFFA9A6),
                            fontWeight: FontWeight.w600,
                            fontSize: 14,
                          ),
                        ),
                        const SizedBox(height: 4),
                        const Text(
                          '길게 눌러 확인하기',
                          style: TextStyle(
                            color: Colors.white70,
                            fontSize: 11,
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
              ),
          ],
        ),
      ),
    );
  }

  void _showDestructiveViewerDialog() {
    // Navigate or display destructive full-screen secure media viewer
  }
}`
};
