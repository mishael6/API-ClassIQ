import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, StyleSheet, SafeAreaView, TouchableOpacity,
  TextInput, ScrollView, ActivityIndicator, Alert, BackHandler,
  Animated, FlatList, KeyboardAvoidingView, Platform,
} from 'react-native';
import { useTheme } from '../../theme/ThemeContext';
import { AppIcon } from '../../components/AppIcon';
import { authStore } from '../../store/authStore';
import { generateTrivia, submitTrivia, fetchLeaderboard } from '../../api/trivia';
import { spacing, radius, getTypography } from '../../theme';

const QUESTION_TIME = 15;
const TOTAL_QUESTIONS = 5;

const SCREEN = {
  HOME: 'HOME',
  LOADING: 'LOADING',
  QUIZ: 'QUIZ',
  RESULT: 'RESULT',
  LEADERBOARD: 'LEADERBOARD',
};

export default function ClassrepTriviaScreen() {
  const { colors } = useTheme();
  const typography = getTypography(colors);
  const s = makeStyles(colors);

  const [screen, setScreen] = useState(SCREEN.HOME);
  const [courses, setCourses] = useState('');
  const [questions, setQuestions] = useState([]);
  const [sessionId, setSessionId] = useState(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState(null);
  const [fillAnswer, setFillAnswer] = useState('');
  const [answers, setAnswers] = useState([]);
  const [score, setScore] = useState(0);
  const [timeLeft, setTimeLeft] = useState(QUESTION_TIME);
  const [leaderboard, setLeaderboard] = useState([]);
  const [myStats, setMyStats] = useState(null);
  const [resultData, setResultData] = useState(null);
  const [student, setStudent] = useState(null);

  const timerRef = useRef(null);
  const progressAnim = useRef(new Animated.Value(1)).current;

  const getPlayerId = () => student?.student_id ?? student?.id;

  useEffect(() => {
    (async () => {
      const u = await authStore.getUser();
      setStudent(u);
    })();
  }, []);

  useEffect(() => {
    if (screen !== SCREEN.QUIZ) return;
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => true);
    return () => subscription.remove();
  }, [screen]);

  useEffect(() => {
    if (screen !== SCREEN.QUIZ) return;
    setTimeLeft(QUESTION_TIME);
    startProgressBar();

    timerRef.current = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(timerRef.current);
          handleTimeout();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timerRef.current);
  }, [currentIndex, screen]);

  const startProgressBar = () => {
    progressAnim.setValue(1);
    Animated.timing(progressAnim, {
      toValue: 0,
      duration: QUESTION_TIME * 1000,
      useNativeDriver: false,
    }).start();
  };

  const handleTimeout = useCallback(() => {
    recordAnswer(null, false);
  }, [currentIndex, answers, score]);

  const recordAnswer = (given, correct) => {
    clearInterval(timerRef.current);
    const q = questions[currentIndex];
    const newAnswers = [...answers, { question: q.question, given, correct_answer: q.answer, correct }];
    const newScore = correct ? score + 1 : score;

    if (currentIndex + 1 >= TOTAL_QUESTIONS) {
      finishQuiz(newAnswers, newScore);
    } else {
      setAnswers(newAnswers);
      setScore(newScore);
      setSelectedAnswer(null);
      setFillAnswer('');
      setCurrentIndex((i) => i + 1);
    }
  };

  const finishQuiz = async (finalAnswers, finalScore) => {
    setScreen(SCREEN.LOADING);
    try {
      const res = await submitTrivia(getPlayerId(), sessionId, finalAnswers, finalScore);
      setResultData(res);
      setScreen(SCREEN.RESULT);
    } catch (e) {
      Alert.alert('Error', 'Could not submit results. Please try again.');
      setScreen(SCREEN.HOME);
    }
  };

  const handleStart = async () => {
    if (!courses.trim()) {
      Alert.alert('Enter Courses', 'Please enter at least one course before starting.');
      return;
    }
    setScreen(SCREEN.LOADING);
    try {
      const res = await generateTrivia(getPlayerId(), courses);
      setQuestions(res.questions);
      setSessionId(res.session_id);
      setCurrentIndex(0);
      setAnswers([]);
      setScore(0);
      setSelectedAnswer(null);
      setFillAnswer('');
      setScreen(SCREEN.QUIZ);
    } catch (e) {
      Alert.alert('Error', 'Six could not generate questions. Try again.');
      setScreen(SCREEN.HOME);
    }
  };

  const handleLoadLeaderboard = async () => {
  setScreen(SCREEN.LOADING);
  try {
    const res = await fetchLeaderboard(getPlayerId());
    setLeaderboard(res.leaderboard || []);
    setMyStats(res.my_stats);
    setScreen(SCREEN.LEADERBOARD);
  } catch (e) {
    Alert.alert('Error', JSON.stringify(e?.response?.data ?? e?.message ?? e));
    setScreen(SCREEN.HOME);
  }
};

  const handleOptionSelect = (option) => {
    if (selectedAnswer) return;
    const q = questions[currentIndex];
    const correct = option.trim().toLowerCase() === q.answer.trim().toLowerCase();
    setSelectedAnswer(option);
    setTimeout(() => recordAnswer(option, correct), 600);
  };

  const handleFillSubmit = () => {
    if (!fillAnswer.trim()) return;
    const q = questions[currentIndex];
    const correct = fillAnswer.trim().toLowerCase() === q.answer.trim().toLowerCase();
    recordAnswer(fillAnswer.trim(), correct);
    setFillAnswer('');
  };

  // ─── LOADING ─────────────────────────────────────────────────────────
  if (screen === SCREEN.LOADING) {
    return (
      <SafeAreaView style={[s.safe, { backgroundColor: colors.background }]}>
        <View style={s.center}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={[s.loadingText, { color: colors.textSecondary }]}>
            Six is generating your questions...
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  // ─── QUIZ ─────────────────────────────────────────────────────────────
  if (screen === SCREEN.QUIZ) {
    const q = questions[currentIndex];
    const isFillin = q.type === 'fillintheblank';
    const isTrueFalse = q.type === 'truefalse';
    const isMCQ = q.type === 'mcq';

    const progressWidth = progressAnim.interpolate({
      inputRange: [0, 1],
      outputRange: ['0%', '100%'],
    });

    return (
      <SafeAreaView style={[s.safe, { backgroundColor: colors.background }]}>
        <View style={s.quizHeader}>
          <Text style={[s.questionCount, { color: colors.textMuted }]}>
            Question {currentIndex + 1} of {TOTAL_QUESTIONS}
          </Text>
          <View style={[s.timerBadge, { backgroundColor: timeLeft <= 5 ? colors.error : colors.primary }]}>
            <Text style={s.timerText}>{timeLeft}s</Text>
          </View>
        </View>

        <View style={[s.progressTrack, { backgroundColor: colors.border }]}>
          <Animated.View style={[s.progressBar, { width: progressWidth, backgroundColor: timeLeft <= 5 ? colors.error : colors.primary }]} />
        </View>

        <ScrollView
          contentContainerStyle={[s.quizBody, { paddingBottom: 300 }]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          automaticallyAdjustKeyboardInsets={true}
        >
          <View style={[s.questionCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <View style={[s.typeBadge, { backgroundColor: colors.surfaceAlt }]}>
              <Text style={[s.typeText, { color: colors.primary }]}>
                {isMCQ ? 'Multiple Choice' : isTrueFalse ? 'True / False' : 'Fill in the Blank'}
              </Text>
            </View>
            <Text style={[s.questionText, { color: colors.text }]}>{q.question}</Text>
          </View>

          {(isMCQ || isTrueFalse) && q.options.map((opt, i) => {
            const isSelected = selectedAnswer === opt;
            const isCorrect = selectedAnswer && opt.trim().toLowerCase() === q.answer.trim().toLowerCase();
            const isWrong = isSelected && !isCorrect;

            return (
              <TouchableOpacity
                key={i}
                style={[
                  s.optionBtn,
                  { backgroundColor: colors.surface, borderColor: colors.border },
                  isCorrect && { backgroundColor: colors.success + '22', borderColor: colors.success },
                  isWrong && { backgroundColor: colors.error + '22', borderColor: colors.error },
                ]}
                onPress={() => handleOptionSelect(opt)}
                disabled={!!selectedAnswer}
              >
                <Text style={[s.optionText, { color: colors.text }]}>{opt}</Text>
                {isCorrect && <AppIcon name="checkmark-circle" size={20} color={colors.success} />}
                {isWrong && <AppIcon name="close-circle" size={20} color={colors.error} />}
              </TouchableOpacity>
            );
          })}

          {isFillin && (
            <View style={s.fillContainer}>
              <TextInput
                style={[s.fillInput, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.text }]}
                placeholder="Type your answer..."
                placeholderTextColor={colors.textMuted}
                value={fillAnswer}
                onChangeText={setFillAnswer}
                returnKeyType="done"
                onSubmitEditing={handleFillSubmit}
                autoFocus
              />
              <TouchableOpacity
                style={[s.submitBtn, { backgroundColor: colors.primary }]}
                onPress={handleFillSubmit}
              >
                <Text style={s.submitBtnText}>Submit</Text>
              </TouchableOpacity>
            </View>
          )}
        </ScrollView>
      </SafeAreaView>
    );
  }

  // ─── RESULT ───────────────────────────────────────────────────────────
  if (screen === SCREEN.RESULT) {
    const passed = resultData?.score >= 3;
    return (
      <SafeAreaView style={[s.safe, { backgroundColor: colors.background }]}>
        <ScrollView contentContainerStyle={s.center}>
          <AppIcon
            name={passed ? 'trophy' : 'refresh-circle'}
            size={72}
            color={passed ? colors.warning : colors.primary}
            style={{ marginBottom: spacing.md }}
          />
          <Text style={[typography.h1, { textAlign: 'center', marginBottom: spacing.xs }]}>
            {passed ? 'Great Job! 🎉' : 'Keep Practicing!'}
          </Text>
          <Text style={[typography.body, { color: colors.textSecondary, marginBottom: spacing.lg }]}>
            You scored {resultData?.score} out of {TOTAL_QUESTIONS}
          </Text>

          <View style={s.statsRow}>
            <View style={[s.statCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <Text style={[s.statValue, { color: colors.primary }]}>{resultData?.total_points}</Text>
              <Text style={[s.statLabel, { color: colors.textMuted }]}>Total Points</Text>
            </View>
            <View style={[s.statCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <Text style={[s.statValue, { color: colors.purple }]}>#{resultData?.rank}</Text>
              <Text style={[s.statLabel, { color: colors.textMuted }]}>Global Rank</Text>
            </View>
            <View style={[s.statCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <Text style={[s.statValue, { color: colors.success }]}>{resultData?.total_sessions}</Text>
              <Text style={[s.statLabel, { color: colors.textMuted }]}>Sessions</Text>
            </View>
          </View>

          <TouchableOpacity
            style={[s.primaryBtn, { backgroundColor: colors.primary }]}
            onPress={() => setScreen(SCREEN.HOME)}
          >
            <Text style={s.primaryBtnText}>Play Again</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[s.outlineBtn, { borderColor: colors.border }]}
            onPress={handleLoadLeaderboard}
          >
            <Text style={[s.outlineBtnText, { color: colors.text }]}>View Leaderboard</Text>
          </TouchableOpacity>
        </ScrollView>
      </SafeAreaView>
    );
  }

  // ─── LEADERBOARD ──────────────────────────────────────────────────────
  if (screen === SCREEN.LEADERBOARD) {
    return (
      <SafeAreaView style={[s.safe, { backgroundColor: colors.background }]}>
        <View style={s.lbHeader}>
          <TouchableOpacity onPress={() => setScreen(SCREEN.HOME)}>
            <AppIcon name="arrow-back" size={24} color={colors.text} />
          </TouchableOpacity>
          <Text style={[typography.h2, { marginLeft: spacing.sm }]}>Leaderboard</Text>
        </View>

        {myStats && (
          <View style={[s.myRankBanner, { backgroundColor: colors.primary }]}>
            <Text style={s.myRankText}>Your Rank: #{myStats.rank}</Text>
            <Text style={s.myRankPoints}>{myStats.total_points} pts</Text>
          </View>
        )}

        <FlatList
          data={leaderboard}
          keyExtractor={(item, i) => String(item.student_id ?? i)}
          contentContainerStyle={{ padding: spacing.md }}
          renderItem={({ item, index }) => (
            <View style={[s.lbRow, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <Text style={[s.lbRank, { color: index < 3 ? colors.warning : colors.textMuted }]}>
                #{index + 1}
              </Text>
              <View style={{ flex: 1 }}>
                <Text style={[s.lbName, { color: colors.text }]}>{item.name}</Text>
                <Text style={[s.lbSub, { color: colors.textMuted }]}>{item.institution}</Text>
              </View>
              <Text style={[s.lbPoints, { color: colors.primary }]}>{item.total_points} pts</Text>
            </View>
          )}
        />
      </SafeAreaView>
    );
  }

  // ─── HOME ─────────────────────────────────────────────────────────────
  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: colors.background }}
      behavior="padding"
      keyboardVerticalOffset={80}
    >
      <SafeAreaView style={{ flex: 1 }}>
        <ScrollView
          contentContainerStyle={s.homeContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <AppIcon name="trophy" size={56} color={colors.warning} style={{ marginBottom: spacing.md }} />
          <Text style={[typography.h1, { textAlign: 'center' }]}>Trivia Challenge</Text>
          <Text style={[typography.body, { color: colors.textSecondary, textAlign: 'center', marginTop: spacing.xs, marginBottom: spacing.xl }]}>
            Test your knowledge! Six will generate 5 questions based on your courses.
          </Text>

          <View style={s.infoRow}>
            {[
              { icon: 'help-circle-outline', label: '5 Questions', color: colors.primary },
              { icon: 'timer-outline', label: '15s Each', color: colors.warning },
              { icon: 'shuffle-outline', label: 'Mixed Types', color: colors.purple },
            ].map((item, i) => (
              <View key={i} style={[s.infoCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <AppIcon name={item.icon} size={24} color={item.color} />
                <Text style={[s.infoLabel, { color: colors.textSecondary }]}>{item.label}</Text>
              </View>
            ))}
          </View>

          <View style={[s.inputCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text style={[typography.h3, { marginBottom: spacing.sm }]}>Your Courses</Text>
            <Text style={{ color: colors.textSecondary, fontSize: 13, marginBottom: spacing.sm }}>
              Enter the courses you're currently studying, separated by commas.
            </Text>
            <TextInput
              style={[s.input, { backgroundColor: colors.surfaceAlt, borderColor: colors.border, color: colors.text }]}
              placeholder="e.g. Data Structures, Operating Systems, Calculus"
              placeholderTextColor={colors.textMuted}
              value={courses}
              onChangeText={setCourses}
              multiline
              numberOfLines={3}
              scrollEnabled={false}
            />
          </View>

          <TouchableOpacity
            style={[s.primaryBtn, { backgroundColor: colors.primary }]}
            onPress={handleStart}
          >
            <AppIcon name="play-circle-outline" size={20} color="#fff" style={{ marginRight: spacing.xs }} />
            <Text style={s.primaryBtnText}>Start Trivia</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[s.outlineBtn, { borderColor: colors.border }]}
            onPress={handleLoadLeaderboard}
          >
            <AppIcon name="podium-outline" size={20} color={colors.text} style={{ marginRight: spacing.xs }} />
            <Text style={[s.outlineBtnText, { color: colors.text }]}>View Leaderboard</Text>
          </TouchableOpacity>

          <View style={{ height: 40 }} />
        </ScrollView>
      </SafeAreaView>
    </KeyboardAvoidingView>
  );
}

const makeStyles = (colors) => StyleSheet.create({
  safe: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.lg },
  loadingText: { marginTop: spacing.md, fontSize: 15, textAlign: 'center' },
  homeContent: { alignItems: 'center', padding: spacing.lg, paddingTop: spacing.xxl },
  infoRow: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.lg },
  infoCard: { flex: 1, alignItems: 'center', padding: spacing.md, borderRadius: radius.md, borderWidth: 1, gap: spacing.xs },
  infoLabel: { fontSize: 12, fontWeight: '600', textAlign: 'center' },
  inputCard: { width: '100%', padding: spacing.md, borderRadius: radius.lg, borderWidth: 1, marginBottom: spacing.lg },
  input: { borderRadius: radius.sm, borderWidth: 1, padding: spacing.sm, fontSize: 14, minHeight: 80, textAlignVertical: 'top' },
  primaryBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', width: '100%', padding: spacing.md, borderRadius: radius.full, marginBottom: spacing.sm },
  primaryBtnText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  outlineBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', width: '100%', padding: spacing.md, borderRadius: radius.full, borderWidth: 1, marginBottom: spacing.sm },
  outlineBtnText: { fontWeight: '600', fontSize: 16 },
  quizHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: spacing.md },
  questionCount: { fontSize: 14, fontWeight: '600' },
  timerBadge: { paddingHorizontal: spacing.md, paddingVertical: spacing.xs, borderRadius: radius.full },
  timerText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  progressTrack: { height: 4, marginHorizontal: spacing.md, borderRadius: 2, marginBottom: spacing.md },
  progressBar: { height: 4, borderRadius: 2 },
  quizBody: { padding: spacing.md, gap: spacing.sm },
  questionCard: { borderRadius: radius.lg, borderWidth: 1, padding: spacing.md, marginBottom: spacing.sm },
  typeBadge: { alignSelf: 'flex-start', paddingHorizontal: spacing.sm, paddingVertical: 2, borderRadius: radius.full, marginBottom: spacing.sm },
  typeText: { fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },
  questionText: { fontSize: 17, fontWeight: '600', lineHeight: 24 },
  optionBtn: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderRadius: radius.md, borderWidth: 1.5, padding: spacing.md },
  optionText: { fontSize: 15, flex: 1 },
  fillContainer: { gap: spacing.sm },
  fillInput: { borderRadius: radius.md, borderWidth: 1.5, padding: spacing.md, fontSize: 15 },
  submitBtn: { padding: spacing.md, borderRadius: radius.full, alignItems: 'center' },
  submitBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  statsRow: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.lg },
  statCard: { flex: 1, alignItems: 'center', padding: spacing.md, borderRadius: radius.md, borderWidth: 1 },
  statValue: { fontSize: 22, fontWeight: '700' },
  statLabel: { fontSize: 11, fontWeight: '600', textTransform: 'uppercase', marginTop: 2 },
  lbHeader: { flexDirection: 'row', alignItems: 'center', padding: spacing.md },
  myRankBanner: { margin: spacing.md, borderRadius: radius.md, padding: spacing.md, flexDirection: 'row', justifyContent: 'space-between' },
  myRankText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  myRankPoints: { color: '#fff', fontWeight: '600' },
  lbRow: { flexDirection: 'row', alignItems: 'center', padding: spacing.md, borderRadius: radius.md, borderWidth: 1, marginBottom: spacing.sm, gap: spacing.sm },
  lbRank: { fontSize: 16, fontWeight: '700', width: 36 },
  lbName: { fontWeight: '600', fontSize: 14 },
  lbSub: { fontSize: 12 },
  lbPoints: { fontWeight: '700', fontSize: 15 },
});