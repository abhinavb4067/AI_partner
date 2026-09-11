import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import '../../core/api_client.dart';
import '../../core/env.dart';
import '../../core/theme.dart';
import '../../models/character.dart';
import '../../services/chat_service.dart';
import '../../widgets/gradient_avatar.dart';

/// The app's home screen — a chat-list, but with an Instagram-DM-style story
/// row up top and softer, rounder cards than a straight WhatsApp clone.
class CharacterListScreen extends StatefulWidget {
  const CharacterListScreen({super.key});

  @override
  State<CharacterListScreen> createState() => _CharacterListScreenState();
}

class _CharacterListScreenState extends State<CharacterListScreen> {
  List<CharacterSummary> _characters = [];
  bool _loading = true;
  String? _error;
  String _search = '';

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
      final list = await ChatService.getCharacters();
      setState(() => _characters = list);
    } catch (e) {
      setState(() => _error = apiErrorMessage(e, fallback: 'Failed to load companions.'));
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final filtered = _characters
        .where((c) => c.name.toLowerCase().contains(_search.toLowerCase()))
        .toList();

    return Scaffold(
      appBar: AppBar(
        title: Row(
          children: [
            Container(
              width: 34,
              height: 34,
              decoration: const BoxDecoration(gradient: AppColors.gradient, shape: BoxShape.circle),
              child: const Icon(Icons.auto_awesome, size: 16, color: Colors.white),
            ),
            const SizedBox(width: 10),
            const Text('AI Companions', style: TextStyle(fontSize: 18, fontWeight: FontWeight.w700)),
          ],
        ),
        actions: [
          IconButton(
            icon: const Icon(Icons.person_outline),
            tooltip: 'Profile',
            onPressed: () => context.push('/profile'),
          ),
          IconButton(
            icon: const Icon(Icons.favorite_border),
            tooltip: 'Real Humans',
            onPressed: () => context.push('/discover'),
          ),
          IconButton(
            icon: const Icon(Icons.workspace_premium_outlined),
            tooltip: 'Plans',
            onPressed: () => context.push('/pricing'),
          ),
        ],
      ),
      body: RefreshIndicator(
        color: AppColors.pink,
        onRefresh: _load,
        child: _loading
            ? const Center(child: CircularProgressIndicator(color: AppColors.pink))
            : _error != null
                ? _buildError()
                : CustomScrollView(
                    slivers: [
                      SliverToBoxAdapter(child: _buildStoryRow(filtered)),
                      SliverToBoxAdapter(child: _buildSearch()),
                      if (filtered.isEmpty)
                        const SliverFillRemaining(
                          child: Center(
                            child: Text('No companions found.', style: TextStyle(color: AppColors.textSecondary)),
                          ),
                        )
                      else
                        SliverList.builder(
                          itemCount: filtered.length,
                          itemBuilder: (context, i) => _ChatRow(character: filtered[i]),
                        ),
                    ],
                  ),
      ),
    );
  }

  Widget _buildError() {
    return Center(
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          const Icon(Icons.cloud_off, color: AppColors.textFaint, size: 40),
          const SizedBox(height: 12),
          Text(_error!, style: const TextStyle(color: AppColors.textSecondary), textAlign: TextAlign.center),
          const SizedBox(height: 16),
          ElevatedButton(onPressed: _load, child: const Text('Retry')),
        ],
      ),
    );
  }

  Widget _buildStoryRow(List<CharacterSummary> characters) {
    if (characters.isEmpty) return const SizedBox.shrink();
    return SizedBox(
      height: 96,
      child: ListView.builder(
        scrollDirection: Axis.horizontal,
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 12),
        itemCount: characters.length,
        itemBuilder: (context, i) {
          final c = characters[i];
          return GestureDetector(
            onTap: () => context.push('/chat/${c.idStr}', extra: c),
            child: Padding(
              padding: const EdgeInsets.symmetric(horizontal: 6),
              child: Column(
                children: [
                  GradientAvatar(name: c.name, photoUrl: Env.media(c.photoUrl), size: 60, ring: true),
                  const SizedBox(height: 6),
                  SizedBox(
                    width: 64,
                    child: Text(
                      c.name,
                      textAlign: TextAlign.center,
                      overflow: TextOverflow.ellipsis,
                      style: const TextStyle(fontSize: 11, color: AppColors.textSecondary),
                    ),
                  ),
                ],
              ),
            ),
          );
        },
      ),
    );
  }

  Widget _buildSearch() {
    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 0, 16, 8),
      child: TextField(
        onChanged: (v) => setState(() => _search = v),
        decoration: InputDecoration(
          hintText: 'Search companions…',
          prefixIcon: const Icon(Icons.search, size: 20, color: AppColors.textSecondary),
          contentPadding: const EdgeInsets.symmetric(vertical: 4),
          border: OutlineInputBorder(borderRadius: BorderRadius.circular(24), borderSide: BorderSide.none),
          filled: true,
          fillColor: AppColors.bgCard,
        ),
      ),
    );
  }
}

class _ChatRow extends StatelessWidget {
  const _ChatRow({required this.character});
  final CharacterSummary character;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: Colors.transparent,
      child: InkWell(
        onTap: () => context.push('/chat/${character.idStr}', extra: character),
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
          child: Row(
            children: [
              GradientAvatar(name: character.name, photoUrl: Env.media(character.photoUrl), size: 54),
              const SizedBox(width: 14),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(character.name, style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w600)),
                    const SizedBox(height: 3),
                    Text(
                      _preview(),
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: const TextStyle(fontSize: 13.5, color: AppColors.textSecondary),
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  String _preview() {
    final youPrefix = character.lastMessageSender == 'user' ? 'You: ' : '';
    return '$youPrefix${character.lastMessage ?? character.about ?? 'Available'}';
  }
}
