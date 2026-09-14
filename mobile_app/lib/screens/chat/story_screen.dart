import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';
import '../../core/api_client.dart';
import '../../core/theme.dart';
import '../../services/chat_service.dart';

/// "Our Story" — a relationship timeline built entirely from data the app
/// already had (chat timestamps, remembered facts). Mirrors the web app's
/// src/pages/Story/Story.jsx; see backend/app/api/routes/chat.py:
/// get_relationship_story for the full product rationale.
class StoryScreen extends StatefulWidget {
  const StoryScreen({super.key, required this.charId});
  final String charId;

  @override
  State<StoryScreen> createState() => _StoryScreenState();
}

class _StoryScreenState extends State<StoryScreen> {
  RelationshipStory? _story;
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
      final story = await ChatService.getStory(widget.charId);
      if (mounted) setState(() => _story = story);
    } catch (e) {
      if (mounted) setState(() => _error = apiErrorMessage(e, fallback: 'Could not load your story right now.'));
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Our Story'),
        leading: IconButton(icon: const Icon(Icons.arrow_back), onPressed: () => context.pop()),
      ),
      body: _loading
          ? const Center(child: CircularProgressIndicator(color: AppColors.pink))
          : _error != null
              ? Center(child: Text(_error!, style: const TextStyle(color: AppColors.textSecondary)))
              : (_story == null || !_story!.started)
                  ? _NotStartedYet(characterName: _story?.characterName ?? '')
                  : _StoryBody(story: _story!),
    );
  }
}

class _NotStartedYet extends StatelessWidget {
  const _NotStartedYet({required this.characterName});
  final String characterName;

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(32),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Text('🌱', style: TextStyle(fontSize: 48)),
            const SizedBox(height: 16),
            Text(
              'You and $characterName haven\'t started talking yet.',
              textAlign: TextAlign.center,
              style: const TextStyle(color: AppColors.textSecondary, fontSize: 14),
            ),
            const SizedBox(height: 6),
            const Text(
              'Send your first message to begin your story.',
              textAlign: TextAlign.center,
              style: TextStyle(color: AppColors.textFaint, fontSize: 12),
            ),
          ],
        ),
      ),
    );
  }
}

class _StoryBody extends StatelessWidget {
  const _StoryBody({required this.story});
  final RelationshipStory story;

  @override
  Widget build(BuildContext context) {
    final stage = story.stage;
    return ListView(
      padding: const EdgeInsets.fromLTRB(20, 20, 20, 40),
      children: [
        // ── Hero: relationship stage + progress ──
        Container(
          padding: const EdgeInsets.all(28),
          decoration: BoxDecoration(
            gradient: LinearGradient(
              begin: Alignment.topLeft,
              end: Alignment.bottomRight,
              colors: [AppColors.pink.withOpacity(0.15), AppColors.purple.withOpacity(0.1)],
            ),
            borderRadius: BorderRadius.circular(20),
            border: Border.all(color: AppColors.pink.withOpacity(0.25)),
          ),
          child: Column(
            children: [
              Text(stage?.icon ?? '💕', style: const TextStyle(fontSize: 48)),
              const SizedBox(height: 8),
              Text(stage?.label ?? '', style: const TextStyle(fontSize: 24, fontWeight: FontWeight.w800, color: AppColors.textPrimary)),
              const SizedBox(height: 4),
              Text(
                'Day ${story.daysTogether} with ${story.characterName}',
                style: const TextStyle(color: AppColors.textSecondary, fontSize: 14),
              ),
              if (stage?.nextLabel != null) ...[
                const SizedBox(height: 16),
                ClipRRect(
                  borderRadius: BorderRadius.circular(3),
                  child: LinearProgressIndicator(
                    value: stage!.progress,
                    minHeight: 6,
                    backgroundColor: Colors.white.withOpacity(0.08),
                    valueColor: const AlwaysStoppedAnimation(AppColors.pink),
                  ),
                ),
                const SizedBox(height: 6),
                Text(
                  '${stage.daysToNext} day${stage.daysToNext == 1 ? '' : 's'} until "${stage.nextLabel}"',
                  style: const TextStyle(color: AppColors.textFaint, fontSize: 12),
                ),
              ],
            ],
          ),
        ),
        const SizedBox(height: 20),

        // ── Stats row ──
        Row(
          children: [
            Expanded(child: _StatCard(value: '${story.totalMessages}', label: 'Messages')),
            const SizedBox(width: 10),
            Expanded(child: _StatCard(value: '${story.photosShared}', label: 'Photos')),
            const SizedBox(width: 10),
            Expanded(child: _StatCard(value: '${story.activeDays}', label: 'Days Active')),
          ],
        ),
        const SizedBox(height: 28),

        // ── Milestone timeline ──
        const _SectionLabel('MILESTONES'),
        const SizedBox(height: 14),
        ...story.milestones.map((m) => _MilestoneRow(milestone: m)),

        // ── Things she remembers about you ──
        if (story.memories.isNotEmpty) ...[
          const SizedBox(height: 14),
          _SectionLabel('WHAT ${story.characterName.toUpperCase()} REMEMBERS ABOUT YOU'),
          const SizedBox(height: 14),
          Wrap(
            spacing: 8,
            runSpacing: 8,
            children: story.memories.map((mem) => _MemoryChip(memory: mem)).toList(),
          ),
        ],
      ],
    );
  }
}

class _SectionLabel extends StatelessWidget {
  const _SectionLabel(this.text);
  final String text;

  @override
  Widget build(BuildContext context) => Text(
        text,
        style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w700, color: AppColors.textSecondary, letterSpacing: 0.3),
      );
}

class _StatCard extends StatelessWidget {
  const _StatCard({required this.value, required this.label});
  final String value;
  final String label;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(vertical: 16, horizontal: 8),
      decoration: BoxDecoration(
        color: AppColors.bgPanel,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: AppColors.stroke),
      ),
      child: Column(
        children: [
          Text(value, style: const TextStyle(fontSize: 22, fontWeight: FontWeight.w800, color: AppColors.pink)),
          const SizedBox(height: 2),
          Text(label, style: const TextStyle(fontSize: 11, color: AppColors.textFaint), textAlign: TextAlign.center),
        ],
      ),
    );
  }
}

class _MilestoneRow extends StatelessWidget {
  const _MilestoneRow({required this.milestone});
  final StoryMilestone milestone;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 20),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            width: 28,
            height: 28,
            alignment: Alignment.center,
            decoration: BoxDecoration(
              color: AppColors.bgCard,
              shape: BoxShape.circle,
              border: Border.all(color: AppColors.pink, width: 2),
            ),
            child: Text(milestone.icon, style: const TextStyle(fontSize: 12)),
          ),
          const SizedBox(width: 14),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(milestone.title, style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w600, color: AppColors.textPrimary)),
                const SizedBox(height: 2),
                Text(
                  DateFormat.yMMMd().format(milestone.date),
                  style: const TextStyle(fontSize: 12, color: AppColors.textFaint),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _MemoryChip extends StatelessWidget {
  const _MemoryChip({required this.memory});
  final StoryMemory memory;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
      decoration: BoxDecoration(
        color: AppColors.bgPanel,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: AppColors.stroke),
      ),
      child: RichText(
        text: TextSpan(
          style: const TextStyle(fontSize: 13, color: AppColors.textPrimary),
          children: [
            TextSpan(text: '${memory.key.replaceAll('_', ' ')}: ', style: const TextStyle(color: AppColors.textFaint)),
            TextSpan(text: memory.value, style: const TextStyle(fontWeight: FontWeight.w600)),
          ],
        ),
      ),
    );
  }
}
