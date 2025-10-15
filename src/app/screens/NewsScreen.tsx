

"use client";

import React, { useEffect, useState } from 'react';
import { ScreenHeader } from '@/components/ScreenHeader';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import type { ScreenProps } from '@/app/page';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import { Plus, Edit, Trash2, Loader2, Search } from 'lucide-react';
import { useAdmin, useFirestore } from '@/firebase/provider';
import { collection, onSnapshot, query, orderBy, doc, deleteDoc } from 'firebase/firestore';
import type { NewsArticle } from '@/lib/types';
import { formatDistanceToNow } from 'date-fns';
import { ar, enUS } from 'date-fns/locale';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { useToast } from '@/hooks/use-toast';
import { FirestorePermissionError } from '@/firebase/errors';
import { errorEmitter } from '@/firebase/error-emitter';
import { SearchSheet } from '@/components/SearchSheet';
import { ProfileButton } from '../AppContentWrapper';
import { useTranslation } from '@/components/LanguageProvider';

export function NewsScreen({ navigate, goBack, canGoBack }: ScreenProps) {
  const { isAdmin } = useAdmin();
  const { db } = useFirestore();
  const [news, setNews] = useState<NewsArticle[]>([]);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const { toast } = useToast();
  const { t, language } = useTranslation();
  
  useEffect(() => {
    if (!db) return;
    setLoading(true);
    const newsCollectionRef = collection(db, 'news');
    const q = query(newsCollectionRef, orderBy('timestamp', 'desc'));
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const fetchedNews = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as NewsArticle));
      setNews(fetchedNews);
      setLoading(false);
    }, (error) => {
      console.error("Error fetching news:", error);
      const permissionError = new FirestorePermissionError({ path: 'news', operation: 'list' });
      errorEmitter.emit('permission-error', permissionError);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [db]);
  
  const handleDelete = (articleId: string) => {
    if (!db) return;
    setDeletingId(articleId);
    const docRef = doc(db, 'news', articleId);
    deleteDoc(docRef)
        .then(() => {
            toast({ title: t('delete_success_title'), description: t('delete_news_success_desc') });
        })
        .catch(serverError => {
            const permissionError = new FirestorePermissionError({ path: docRef.path, operation: 'delete' });
            errorEmitter.emit('permission-error', permissionError);
        })
        .finally(() => setDeletingId(null));
  };


  return (
    <div className="flex h-full flex-col bg-background">
      <ScreenHeader 
        title={t('news')} 
        onBack={goBack} 
        canGoBack={canGoBack} 
        actions={
          <div className="flex items-center gap-1">
              <SearchSheet navigate={navigate}>
                  <Button variant="ghost" size="icon">
                      <Search className="h-5 w-5" />
                  </Button>
              </SearchSheet>
              <ProfileButton onProfileClick={() => navigate('Profile')} />
          </div>
        }
      />
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {loading ? (
            Array.from({ length: 3 }).map((_, i) => (
              <Card key={i}>
                <CardHeader>
                  <Skeleton className="aspect-video w-full mb-4 rounded-md" />
                  <Skeleton className="h-6 w-4/5" />
                </CardHeader>
                <CardContent><Skeleton className="h-4 w-full" /></CardContent>
                <CardFooter><Skeleton className="h-4 w-24" /></CardFooter>
              </Card>
            ))
        ) : news.length > 0 ? (
            news.map((article) => (
              <Card key={article.id}>
                {article.imageUrl && (
                    <CardHeader>
                        <div className="relative aspect-video w-full mb-4">
                        <Image 
                            src={article.imageUrl}
                            alt={article.title}
                            fill
                            className="rounded-md object-cover"
                            data-ai-hint={article.imageHint || "football match"}
                        />
                        </div>
                    </CardHeader>
                )}
                <CardHeader>
                  <CardTitle>{article.title}</CardTitle>
                </CardHeader>
                <CardContent>
                   <p className="text-muted-foreground whitespace-pre-line">{article.content}</p>
                </CardContent>
                <CardFooter className="flex justify-between items-center">
                   <p className="text-xs text-muted-foreground">
                    {article.timestamp ? formatDistanceToNow(article.timestamp.toDate(), { addSuffix: true, locale: language === 'ar' ? ar : enUS }) : ''}
                  </p>
                  {isAdmin && (
                    <div className="flex gap-2">
                       <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="destructive" size="icon" disabled={deletingId === article.id}>
                                {deletingId === article.id ? <Loader2 className="h-4 w-4 animate-spin"/> : <Trash2 className="h-4 w-4" />}
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                             <AlertDialogHeader>
                               <AlertDialogTitle>{t('are_you_sure')}</AlertDialogTitle>
                               <AlertDialogDescription>
                                 {t('delete_news_confirm_desc')}
                               </AlertDialogDescription>
                             </AlertDialogHeader>
                             <AlertDialogFooter>
                               <AlertDialogCancel>{t('cancel')}</AlertDialogCancel>
                               <AlertDialogAction onClick={() => handleDelete(article.id!)}>{t('delete')}</AlertDialogAction>
                             </AlertDialogFooter>
                          </AlertDialogContent>
                       </AlertDialog>
                       <Button variant="outline" size="icon" onClick={() => navigate('AddEditNews', { article, isEditing: true })}>
                        <Edit className="h-4 w-4" />
                      </Button>
                    </div>
                  )}
                </CardFooter>
              </Card>
            ))
        ) : (
             <div className="text-center text-muted-foreground pt-10">
                <p className="text-lg font-semibold">{t('no_news_yet_title')}</p>
                {isAdmin && <p>{t('add_news_prompt')}</p>}
            </div>
        )}
      </div>
      {isAdmin && (
          <Button className="absolute bottom-24 right-4 h-14 w-14 rounded-full shadow-lg" size="icon" onClick={() => navigate('AddEditNews', { isEditing: false })}>
              <Plus className="h-6 w-6" />
          </Button>
      )}
    </div>
  );
}
