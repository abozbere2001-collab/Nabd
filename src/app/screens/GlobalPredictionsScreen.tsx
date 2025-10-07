
"use client";

import React, { useState, useEffect } from 'react';
import type { ScreenProps } from '@/app/page';
import { ScreenHeader } from '@/components/ScreenHeader';
import { Card, CardContent } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { Loader2 } from 'lucide-react';
import { format, isPast } from 'date-fns';
import { ar } from 'date-fns/locale';
import { useAuth, useFirestore, useAdmin } from '@/firebase/provider';
import type { Fixture, UserScore, Prediction, DailyGlobalPredictions } from '@/lib/types';
import { collection, query, orderBy, onSnapshot, doc, getDoc, where, setDoc } from 'firebase/firestore';
import { FirestorePermissionError } from '@/firebase/errors';
import { errorEmitter } from '@/firebase/error-emitter';


const AdminMatchSelector = () => {
    // This is a placeholder for the admin-specific UI to select matches.
    // In a full implementation, this would fetch matches from the API and allow the admin to pick them.
    return (
        <Card>
            <CardContent className="p-4">
                <h3 className="font-bold text-lg mb-2">لوحة تحكم المدير: اختيار المباريات</h3>
                <p className="text-sm text-muted-foreground">
                    هنا يمكن للمدير اختيار ما يصل إلى 15 مباراة لليوم. إذا لم يتم اختيار أي شيء، سيقوم النظام تلقائيًا باختيار ما يصل إلى 10 مباريات مهمة. هذه الميزة سيتم تفعيلها في مرحلة لاحقة.
                </p>
            </CardContent>
        </Card>
    )
}

const PredictionCard = ({ fixture, userPrediction, onSave }: { fixture: Fixture, userPrediction?: Prediction, onSave: (home: string, away: string) => void }) => {
    const isPredictionDisabled = isPast(new Date(fixture.fixture.date));
    const [homeValue, setHomeValue] = useState(userPrediction?.homeGoals?.toString() ?? '');
    const [awayValue, setAwayValue] = useState(userPrediction?.awayGoals?.toString() ?? '');

    const handleHomeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setHomeValue(e.target.value);
        onSave(e.target.value, awayValue);
    }

    const handleAwayChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setAwayValue(e.target.value);
        onSave(homeValue, e.target.value);
    }

    return (
        <Card className="p-4">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 flex-1">
                    <Avatar><AvatarImage src={fixture.teams.home.logo} /></Avatar>
                    <span className="font-semibold">{fixture.teams.home.name}</span>
                </div>
                <div className="flex items-center gap-2">
                    <Input 
                        type="number" 
                        className="w-14 h-8 text-center" 
                        min="0" 
                        value={homeValue}
                        onChange={handleHomeChange}
                        id={`home-${fixture.fixture.id}`}
                        disabled={isPredictionDisabled}
                    />
                    <span>-</span>
                    <Input 
                        type="number" 
                        className="w-14 h-8 text-center" 
                        min="0"
                        value={awayValue}
                        onChange={handleAwayChange}
                        id={`away-${fixture.fixture.id}`}
                        disabled={isPredictionDisabled}
                    />
                </div>
                <div className="flex items-center gap-2 flex-1 justify-end">
                    <span className="font-semibold">{fixture.teams.away.name}</span>
                    <Avatar><AvatarImage src={fixture.teams.away.logo} /></Avatar>
                </div>
            </div>
            <div className="text-center text-xs text-muted-foreground mt-2">
                <span>{fixture.league.name}</span> - <span>{format(new Date(fixture.fixture.date), "EEE, d MMM, HH:mm", { locale: ar })}</span>
            </div>
            {isPredictionDisabled && userPrediction?.points !== undefined && (
                 <p className="text-center text-primary font-bold text-sm mt-2">
                    +{userPrediction.points} نقاط
                </p>
            )}
            {userPrediction && !isPredictionDisabled && <p className="text-center text-green-600 text-xs mt-2">تم حفظ توقعك</p>}
            {isPredictionDisabled && !userPrediction && <p className="text-center text-red-600 text-xs mt-2">أغلق باب التوقع</p>}
        </Card>
    );
};


export function GlobalPredictionsScreen({ navigate, goBack, canGoBack, headerActions }: ScreenProps) {
    const { isAdmin } = useAdmin();
    const { user } = useAuth();
    const { db } = useFirestore();
    const [loading, setLoading] = useState(true);
    const [selectedMatches, setSelectedMatches] = useState<Fixture[]>([]);
    const [leaderboard, setLeaderboard] = useState<UserScore[]>([]);
    const [predictions, setPredictions] = useState<{ [key: number]: Prediction }>({});

    useEffect(() => {
        setLoading(true);

        const leaderboardRef = query(collection(db, 'leaderboard'), orderBy('totalPoints', 'desc'));
        const unsubscribeLeaderboard = onSnapshot(leaderboardRef, (snapshot) => {
            const scores: UserScore[] = [];
            snapshot.forEach(doc => scores.push(doc.data() as UserScore));
            setLeaderboard(scores);
        }, (error) => {
            const permissionError = new FirestorePermissionError({ path: 'leaderboard', operation: 'list' });
            errorEmitter.emit('permission-error', permissionError);
        });
        
        const fetchDailyMatches = async () => {
            const today = format(new Date(), 'yyyy-MM-dd');
            const dailyDocRef = doc(db, 'dailyGlobalPredictions', today);
            try {
                const docSnap = await getDoc(dailyDocRef);
                if (docSnap.exists()) {
                    const dailyData = docSnap.data() as DailyGlobalPredictions;
                    if (dailyData.selectedMatches && dailyData.selectedMatches.length > 0) {
                        const fixtureIds = dailyData.selectedMatches.map(m => m.fixtureId).join('-');
                        const res = await fetch(`/api/football/fixtures?ids=${fixtureIds}`);
                        const data = await res.json();
                        if (data.response) {
                             setSelectedMatches(data.response);
                        }
                    }
                }
            } catch (error) {
                 const permissionError = new FirestorePermissionError({ path: dailyDocRef.path, operation: 'get' });
                 errorEmitter.emit('permission-error', permissionError);
            } finally {
                setLoading(false);
            }
        };

        fetchDailyMatches();
        
        if (user) {
            const predsRef = collection(db, 'predictions');
            const userPredsQuery = query(predsRef, where('userId', '==', user.uid));
            const unsubscribePreds = onSnapshot(userPredsQuery, (snapshot) => {
                const userPredictions: { [key: number]: Prediction } = {};
                snapshot.forEach(doc => {
                    const pred = doc.data() as Prediction;
                    userPredictions[pred.fixtureId] = pred;
                });
                setPredictions(userPredictions);
            }, (error) => {
                 const permissionError = new FirestorePermissionError({ path: 'predictions', operation: 'list' });
                 errorEmitter.emit('permission-error', permissionError);
            });
             return () => { 
                unsubscribeLeaderboard();
                unsubscribePreds();
            };
        }


        return () => {
            unsubscribeLeaderboard();
        };
    }, [db, user]);

    const handleSavePrediction = async (fixtureId: number, homeGoalsStr: string, awayGoalsStr: string) => {
        if (!user || homeGoalsStr === '' || awayGoalsStr === '') return;
        const homeGoals = parseInt(homeGoalsStr, 10);
        const awayGoals = parseInt(awayGoalsStr, 10);
        if (isNaN(homeGoals) || isNaN(awayGoals)) return;

        const predictionRef = doc(db, 'predictions', `${user.uid}_${fixtureId}`);
        const predictionData: Prediction = {
            userId: user.uid,
            fixtureId,
            homeGoals,
            awayGoals,
            timestamp: new Date().toISOString()
        };
        try {
            await setDoc(predictionRef, predictionData, { merge: true });
        } catch (error) {
            const permissionError = new FirestorePermissionError({
              path: predictionRef.path,
              operation: 'create',
              requestResourceData: predictionData
            });
            errorEmitter.emit('permission-error', permissionError);
        }
    };


    return (
        <div className="flex h-full flex-col bg-background">
            <ScreenHeader title="التوقعات العالمية" onBack={goBack} canGoBack={canGoBack} actions={headerActions} />
            <div className="flex-1 overflow-y-auto p-4 space-y-6">

                {isAdmin && <AdminMatchSelector />}

                <div>
                    <h3 className="text-xl font-bold mb-3">مباريات اليوم للتوقع</h3>
                    {loading ? (
                         <div className="space-y-4">
                            {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-24 w-full" />)}
                        </div>
                    ) : selectedMatches.length > 0 ? (
                        <div className="space-y-4">
                           {selectedMatches.map(fixture => (
                               <PredictionCard 
                                 key={fixture.fixture.id}
                                 fixture={fixture}
                                 userPrediction={predictions[fixture.fixture.id]}
                                 onSave={(home, away) => handleSavePrediction(fixture.fixture.id, home, away)}
                               />
                           ))}
                        </div>
                    ) : (
                        <Card>
                           <CardContent className="p-6 text-center text-muted-foreground">
                                <p>لم يتم اختيار أي مباريات للتوقع لهذا اليوم بعد.</p>
                                <p className="text-xs">سيقوم النظام باختيار مباريات مهمة قريبًا أو يمكن للمدير اختيارها يدويًا.</p>
                           </CardContent>
                        </Card>
                    )}
                </div>

                <div>
                    <h3 className="text-xl font-bold mb-3">لوحة الصدارة العالمية</h3>
                     <Card>
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>الترتيب</TableHead>
                                    <TableHead>المستخدم</TableHead>
                                    <TableHead className="text-center">النقاط</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {loading && leaderboard.length === 0 ? (
                                    Array.from({ length: 5 }).map((_, i) => (
                                        <TableRow key={i}>
                                            <TableCell><Skeleton className="h-4 w-4" /></TableCell>
                                            <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                                            <TableCell className="text-center"><Skeleton className="h-4 w-8 mx-auto" /></TableCell>
                                        </TableRow>
                                    ))
                                ) : leaderboard.length > 0 ? (
                                     leaderboard.map((score, index) => (
                                        <TableRow key={score.userId}>
                                            <TableCell>{index + 1}</TableCell>
                                            <TableCell>
                                                <div className="flex items-center gap-2">
                                                    <Avatar className="h-6 w-6">
                                                        <AvatarImage src={score.userPhoto}/>
                                                        <AvatarFallback>{score.userName.charAt(0)}</AvatarFallback>
                                                    </Avatar>
                                                    {score.userName}
                                                </div>
                                            </TableCell>
                                            <TableCell className="text-center font-bold">{score.totalPoints}</TableCell>
                                        </TableRow>
                                    ))
                                ) : (
                                    <TableRow>
                                        <TableCell colSpan={3} className="text-center text-muted-foreground h-24">
                                            لا توجد بيانات لعرضها في لوحة الصدارة بعد.
                                        </TableCell>
                                    </TableRow>
                                )}
                            </TableBody>
                        </Table>
                    </Card>
                </div>
            </div>
        </div>
    );
}
