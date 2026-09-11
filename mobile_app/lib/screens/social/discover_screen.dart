import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import '../../core/api_client.dart';
import '../../core/env.dart';
import '../../core/theme.dart';
import '../../services/social_service.dart';
import '../../widgets/gradient_avatar.dart';

/// Tinder/Instagram-Explore-flavored "Real Humans" discovery — swipe right to
/// like, left to pass. A mutual like creates a match.
class DiscoverScreen extends StatefulWidget {
  const DiscoverScreen({super.key});

  @override
  State<DiscoverScreen> createState() => _DiscoverScreenState();
}

class _DiscoverScreenState extends State<DiscoverScreen> with SingleTickerProviderStateMixin {
  List<SocialUser> _stack = [];
  bool _loading = true;
  String? _error;
  Offset _drag = Offset.zero;
  bool _busy = false;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final users = await SocialService.discover();
      setState(() => _stack = users);
    } catch (e) {
      setState(() => _error = apiErrorMessage(e, fallback: 'Failed to load people nearby.'));
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _decide(bool like) async {
    if (_stack.isEmpty || _busy) return;
    final user = _stack.first;
    setState(() {
      _busy = true;
      _drag = Offset.zero;
    });
    try {
      final matched = await SocialService.swipe(targetId: user.id, isLike: like);
      setState(() => _stack.removeAt(0));
      if (matched && mounted) _showMatchDialog(user);
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(apiErrorMessage(e))));
      }
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  void _showMatchDialog(SocialUser user) {
    showDialog(
      context: context,
      builder: (ctx) => Dialog(
        backgroundColor: Colors.transparent,
        child: Container(
          padding: const EdgeInsets.all(28),
          decoration: BoxDecoration(gradient: AppColors.gradient, borderRadius: BorderRadius.circular(24)),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              const Text('🎉', style: TextStyle(fontSize: 48)),
              const SizedBox(height: 12),
              const Text("It's a Match!", style: TextStyle(color: Colors.white, fontSize: 24, fontWeight: FontWeight.w800)),
              const SizedBox(height: 6),
              Text('You and ${user.name ?? user.username} liked each other',
                  textAlign: TextAlign.center, style: const TextStyle(color: Colors.white70)),
              const SizedBox(height: 20),
              Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  TextButton(
                    onPressed: () => Navigator.pop(ctx),
                    child: const Text('Keep Swiping', style: TextStyle(color: Colors.white70)),
                  ),
                  const SizedBox(width: 8),
                  ElevatedButton(
                    style: ElevatedButton.styleFrom(backgroundColor: Colors.white, foregroundColor: AppColors.pink),
                    onPressed: () {
                      Navigator.pop(ctx);
                      context.push('/human-chat/${user.id}', extra: user);
                    },
                    child: const Text('Say Hi'),
                  ),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Real Humans'),
        actions: [
          IconButton(icon: const Icon(Icons.favorite), onPressed: () => context.push('/matches')),
        ],
      ),
      body: _loading
          ? const Center(child: CircularProgressIndicator(color: AppColors.pink))
          : _error != null
              ? Center(child: Text(_error!, style: const TextStyle(color: AppColors.textSecondary)))
              : _stack.isEmpty
                  ? _buildEmpty()
                  : _buildStack(),
    );
  }

  Widget _buildEmpty() {
    return Center(
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          const Text('✨', style: TextStyle(fontSize: 48)),
          const SizedBox(height: 12),
          const Text("You're all caught up", style: TextStyle(fontSize: 18, fontWeight: FontWeight.w600)),
          const SizedBox(height: 6),
          const Text('Check back later for more people.', style: TextStyle(color: AppColors.textSecondary)),
          const SizedBox(height: 20),
          ElevatedButton(onPressed: _load, child: const Text('Refresh')),
        ],
      ),
    );
  }

  Widget _buildStack() {
    return Padding(
      padding: const EdgeInsets.all(20),
      child: Column(
        children: [
          Expanded(
            child: Stack(
              alignment: Alignment.center,
              children: _stack.reversed.toList().asMap().entries.map((entry) {
                final reverseIndex = entry.key;
                final isTop = reverseIndex == _stack.length - 1;
                final user = entry.value;
                if (!isTop) return _buildCard(user, Offset.zero, 0);
                return GestureDetector(
                  onPanUpdate: (d) => setState(() => _drag += d.delta),
                  onPanEnd: (_) {
                    if (_drag.dx > 120) {
                      _decide(true);
                    } else if (_drag.dx < -120) {
                      _decide(false);
                    } else {
                      setState(() => _drag = Offset.zero);
                    }
                  },
                  child: _buildCard(user, _drag, _drag.dx / 20),
                );
              }).toList(),
            ),
          ),
          const SizedBox(height: 16),
          Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              _roundButton(Icons.close, Colors.redAccent, () => _decide(false)),
              const SizedBox(width: 28),
              _roundButton(Icons.favorite, AppColors.pink, () => _decide(true)),
            ],
          ),
        ],
      ),
    );
  }

  Widget _roundButton(IconData icon, Color color, VoidCallback onTap) {
    return Material(
      color: AppColors.bgCard,
      shape: const CircleBorder(),
      child: InkWell(
        onTap: _busy ? null : onTap,
        customBorder: const CircleBorder(),
        child: Padding(
          padding: const EdgeInsets.all(18),
          child: Icon(icon, color: color, size: 30),
        ),
      ),
    );
  }

  Widget _buildCard(SocialUser user, Offset offset, double angleDeg) {
    return Transform.translate(
      offset: offset,
      child: Transform.rotate(
        angle: angleDeg * 0.0174533,
        child: Container(
          width: double.infinity,
          decoration: BoxDecoration(
            gradient: LinearGradient(
              begin: Alignment.topCenter,
              end: Alignment.bottomCenter,
              colors: AppColors.avatarGradientFor(user.name ?? user.username ?? user.id),
            ),
            borderRadius: BorderRadius.circular(24),
          ),
          child: Stack(
            children: [
              if (user.avatarUrl != null && user.avatarUrl!.isNotEmpty)
                Positioned.fill(
                  child: ClipRRect(
                    borderRadius: BorderRadius.circular(24),
                    child: Image.network(Env.media(user.avatarUrl), fit: BoxFit.cover,
                        errorBuilder: (_, __, ___) => const SizedBox()),
                  ),
                ),
              Positioned(
                left: 0,
                right: 0,
                bottom: 0,
                child: Container(
                  padding: const EdgeInsets.all(20),
                  decoration: BoxDecoration(
                    borderRadius: const BorderRadius.vertical(bottom: Radius.circular(24)),
                    gradient: LinearGradient(
                      begin: Alignment.topCenter,
                      end: Alignment.bottomCenter,
                      colors: [Colors.transparent, Colors.black.withOpacity(0.65)],
                    ),
                  ),
                  child: Row(
                    children: [
                      if (user.avatarUrl == null || user.avatarUrl!.isEmpty)
                        Padding(
                          padding: const EdgeInsets.only(right: 12),
                          child: GradientAvatar(name: user.name ?? user.username ?? '?', size: 48),
                        ),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              '${user.name ?? user.username ?? 'Someone'}${user.age != null ? ', ${user.age}' : ''}',
                              style: const TextStyle(color: Colors.white, fontSize: 22, fontWeight: FontWeight.w700),
                            ),
                            if (user.username != null)
                              Text('@${user.username}', style: const TextStyle(color: Colors.white70, fontSize: 13)),
                          ],
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
