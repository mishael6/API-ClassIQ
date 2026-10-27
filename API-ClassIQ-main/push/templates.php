<?php
// api/push/templates.php — automated push message pools

function push_motivation_messages(): array {
    return [
        'Good morning! 🌅 A new day, a new chance to show up and win. You\'ve got this!',
        'Rise and shine! ☀️ Consistency beats talent. Make today count at class.',
        'Morning champion! 💪 Small steps every day lead to big results. Go get it!',
        'Hey early bird! 🐦 Your future self will thank you for attending today.',
        'New day, fresh start! ✨ Believe in yourself — you are capable of amazing things.',
        'Good morning! 📚 Education is your superpower. Use it wisely today.',
        'Wake up with determination! 🎯 Go to bed with satisfaction. Make today great.',
        'Morning! 🌟 Don\'t wait for opportunity — create it by showing up.',
        'Today is a gift. 🎁 That\'s why they call it the present. Make the most of it!',
        'Good morning! 🚀 Great things never come from comfort zones. Step up today.',
        'Start strong! 💫 The secret of getting ahead is getting started. Begin now.',
        'Morning motivation: You are one class away from a better version of yourself.',
        'Hey! 🌈 Difficult roads often lead to beautiful destinations. Keep going!',
        'Good morning! ⭐ Attendance today = success tomorrow. We believe in you!',
        'Rise up! 🔥 Every expert was once a beginner who never gave up.',
    ];
}

function push_feature_messages(): array {
    return [
        '📱 Did you know? Scan QR codes in the Scanner tab to mark attendance instantly!',
        '🏆 Check the Trivia tab — earn points and climb the weekly leaderboard!',
        '✨ Try AI Study (Six) — upload notes and get explanations, MCQs & flashcards!',
        '📊 View your attendance stats on Home — track your percentage all semester.',
        '🔔 Enable push notifications in Settings to never miss attendance alerts!',
        '💡 Report issues directly in the app — admins respond fast via the Issues tab.',
        '🎯 Consistent attendance boosts your trivia rank. Scan QR every class!',
        '📸 AI Study supports photos — snap your notes and Six explains them for you.',
        '🌙 Turn on Night Mode in Settings for comfortable late-night studying.',
        '📈 Top students on the leaderboard win rewards. Are you on the board yet?',
    ];
}

function push_attendance_success_message(string $lecture, string $status): array {
    $lecture = $lecture ?: 'your class';
    if ($status === 'Flagged') {
        return [
            'title' => 'Attendance Recorded ⚠️',
            'body'  => "Your attendance for {$lecture} was saved but flagged for review. Contact your class rep if needed.",
        ];
    }
    return [
        'title' => 'Attendance Marked ✅',
        'body'  => "You're present for {$lecture}! Great job showing up. Keep your streak going! 🎉",
    ];
}

function pick_random_message(array $pool): string {
    return $pool[array_rand($pool)];
}

function pick_daily_message(string $type): string {
    $pool = $type === 'feature' ? push_feature_messages() : push_motivation_messages();
    // Same message for everyone on a given day (rotate by date)
    $day_index = (int)date('z') % count($pool);
    return $pool[$day_index];
}
