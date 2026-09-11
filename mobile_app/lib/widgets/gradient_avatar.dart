import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import '../core/theme.dart';

/// A circular avatar that falls back to a deterministic gradient + initial
/// (Instagram-story-ring flavored) when there's no photo yet.
class GradientAvatar extends StatelessWidget {
  const GradientAvatar({
    super.key,
    required this.name,
    this.photoUrl,
    this.size = 48,
    this.ring = false,
    this.online = false,
  });

  final String name;
  final String? photoUrl;
  final double size;
  final bool ring;
  final bool online;

  @override
  Widget build(BuildContext context) {
    final colors = AppColors.avatarGradientFor(name);
    final initial = name.isNotEmpty ? name[0].toUpperCase() : '?';

    Widget circle = Container(
      width: size,
      height: size,
      decoration: BoxDecoration(
        shape: BoxShape.circle,
        gradient: LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: colors,
        ),
      ),
      clipBehavior: Clip.antiAlias,
      child: photoUrl != null && photoUrl!.isNotEmpty
          ? CachedNetworkImage(
              imageUrl: photoUrl!,
              fit: BoxFit.cover,
              errorWidget: (_, __, ___) => _initialText(initial),
              placeholder: (_, __) => _initialText(initial),
            )
          : _initialText(initial),
    );

    if (ring) {
      circle = Container(
        padding: const EdgeInsets.all(2.5),
        decoration: const BoxDecoration(
          shape: BoxShape.circle,
          gradient: AppColors.storyRing,
        ),
        child: Container(
          padding: const EdgeInsets.all(2),
          decoration: const BoxDecoration(shape: BoxShape.circle, color: AppColors.bgDeep),
          child: circle,
        ),
      );
    }

    if (!online) return circle;

    return Stack(
      clipBehavior: Clip.none,
      children: [
        circle,
        Positioned(
          bottom: 0,
          right: 0,
          child: Container(
            width: size * 0.28,
            height: size * 0.28,
            decoration: BoxDecoration(
              shape: BoxShape.circle,
              color: AppColors.teal,
              border: Border.all(color: AppColors.bgDeep, width: 2),
            ),
          ),
        ),
      ],
    );
  }

  Widget _initialText(String initial) => Center(
        child: Text(
          initial,
          style: TextStyle(
            color: Colors.white.withOpacity(0.92),
            fontWeight: FontWeight.w700,
            fontSize: size * 0.4,
          ),
        ),
      );
}
