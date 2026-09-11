import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import '../../core/api_client.dart';
import '../../core/env.dart';
import '../../core/theme.dart';
import '../../services/social_service.dart';
import '../../widgets/gradient_avatar.dart';

class MatchesScreen extends StatefulWidget {
  const MatchesScreen({super.key});

  @override
  State<MatchesScreen> createState() => _MatchesScreenState();
}

class _MatchesScreenState extends State<MatchesScreen> {
  List<HumanMatch> _matches = [];
  bool _loading = true;
  String? _error;

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
      final matches = await SocialService.getMatches();
      setState(() => _matches = matches);
    } catch (e) {
      setState(() => _error = apiErrorMessage(e, fallback: 'Failed to load matches.'));
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Your Matches')),
      body: RefreshIndicator(
        color: AppColors.pink,
        onRefresh: _load,
        child: _loading
            ? const Center(child: CircularProgressIndicator(color: AppColors.pink))
            : _error != null
                ? Center(child: Text(_error!, style: const TextStyle(color: AppColors.textSecondary)))
                : _matches.isEmpty
                    ? ListView(
                        children: const [
                          SizedBox(height: 120),
                          Center(child: Text('No matches yet — keep swiping in Discover!', style: TextStyle(color: AppColors.textSecondary))),
                        ],
                      )
                    : ListView.builder(
                        padding: const EdgeInsets.all(12),
                        itemCount: _matches.length,
                        itemBuilder: (context, i) {
                          final m = _matches[i];
                          return ListTile(
                            onTap: () => context.push('/human-chat/${m.user.id}', extra: m.user),
                            leading: GradientAvatar(
                              name: m.user.name ?? m.user.username ?? '?',
                              photoUrl: Env.media(m.user.avatarUrl),
                              size: 52,
                            ),
                            title: Text(m.user.name ?? m.user.username ?? 'Someone'),
                            subtitle: Text('@${m.user.username ?? ''}', style: const TextStyle(color: AppColors.textSecondary)),
                            trailing: const Icon(Icons.chat_bubble_outline, color: AppColors.pink),
                          );
                        },
                      ),
      ),
    );
  }
}
