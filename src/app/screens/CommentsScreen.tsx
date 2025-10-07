
"use client";

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { ScreenHeader } from '@/components/ScreenHeader';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
import { Loader2, Send, MoreVertical, Edit, Trash2, CornerDownRight, Heart } from 'lucide-react';
import type { ScreenProps } from '@/app/page';
import { useAuth, useFirestore } from '@/firebase/provider';
import { collection, addDoc, serverTimestamp, query, orderBy, onSnapshot, doc, updateDoc, deleteDoc, writeBatch, getDocs, where } from 'firebase/firestore';
import type { MatchComment, Like } from '@/lib/types';
import { formatDistanceToNow } from 'date-fns';
import { ar } from 'date-fns/locale';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
import { cn } from '@/lib/utils';

interface CommentsScreenProps extends ScreenProps {
  matchId: number;
}


const CommentInput = ({
    user,
    sending,
    onSend,
    initialText = '',
    parentId = null,
    onCancel,
    autoFocus = false,
}: {
    user: any,
    sending: boolean,
    onSend: (text: string, parentId?: string | null) => Promise<void>,
    initialText?: string,
    parentId?: string | null,
    onCancel?: () => void,
    autoFocus?: boolean,
}) => {
    const [text, setText] = useState(initialText);

    const handleSend = async () => {
        if (!text.trim()) return;
        await onSend(text, parentId);
        setText('');
    };

    return (
         <div className={cn("flex items-start gap-2", onCancel ? 'mt-2' : 'sticky bottom-0 bg-background border-t p-4')}>
            {onCancel && (
                <Avatar className="h-8 w-8">
                    <AvatarImage src={user?.photoURL} />
                    <AvatarFallback>{user?.displayName?.charAt(0)}</AvatarFallback>
                </Avatar>
            )}
            <div className="flex-1 space-y-2">
                <Textarea
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    placeholder={parentId ? "اكتب ردك..." : "اكتب تعليقك..."}
                    className="flex-1 bg-card border-none focus-visible:ring-1 focus-visible:ring-ring"
                    rows={1}
                    autoFocus={autoFocus}
                    onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                            e.preventDefault();
                            handleSend();
                        }
                    }}
                />
                 <div className="flex justify-end gap-2">
                    {onCancel && <Button variant="ghost" size="sm" onClick={onCancel}>إلغاء</Button>}
                    <Button onClick={handleSend} disabled={sending || !text.trim()} size={onCancel ? "sm" : "icon"}>
                    {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : onCancel ? 'رد' : <Send className="h-4 w-4" />}
                    </Button>
                </div>
            </div>
        </div>
    );
};


const CommentItem = ({
    comment,
    user,
    onEdit,
    onDelete,
    onReply,
    isDeleting,
    isEditing,
    onUpdate,
    onCancelEdit,
    onLike,
    sending,
    editingText,
    setEditingText,
}: {
    comment: MatchComment,
    user: any,
    onEdit: (comment: MatchComment) => void,
    onDelete: (commentId: string) => void,
    onReply: (commentId: string) => void,
    onLike: (commentId: string) => void,
    isDeleting: string | null,
    isEditing: boolean,
    onUpdate: () => void,
    onCancelEdit: () => void,
    sending: boolean,
    editingText: string,
    setEditingText: (text: string) => void,
}) => {
    const hasLiked = user && comment.likes?.some(like => like.id === user.uid);
    
    return (
        <div className="flex items-start gap-3">
          <Avatar>
            <AvatarImage src={comment.userPhoto} />
            <AvatarFallback>{comment.userName?.charAt(0)}</AvatarFallback>
          </Avatar>
          <div className="flex-1 rounded-lg bg-card border p-3 w-full min-w-0">
            <div className="flex items-center justify-between mb-1">
              <p className="font-semibold text-sm">{comment.userName}</p>
              {comment.timestamp && (
                <p className="text-xs text-muted-foreground">
                  {formatDistanceToNow(comment.timestamp.toDate(), { addSuffix: true, locale: ar })}
                </p>
              )}
            </div>
            {isEditing ? (
              <div className="space-y-2">
                <Textarea
                  value={editingText}
                  onChange={(e) => setEditingText(e.target.value)}
                  className="bg-background"
                  autoFocus
                />
                <div className="flex justify-end gap-2">
                  <Button variant="ghost" size="sm" onClick={onCancelEdit}>إلغاء</Button>
                  <Button size="sm" onClick={onUpdate} disabled={sending}>
                    {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : 'حفظ'}
                  </Button>
                </div>
              </div>
            ) : (
              <p className="text-sm text-foreground/90 whitespace-pre-wrap break-words">{comment.text}</p>
            )}
            
            {!isEditing && (
                 <div className="flex items-center gap-2 mt-2 -mb-2 -ml-2">
                    <Button variant="ghost" size="sm" onClick={() => onReply(comment.id!)}>
                        <CornerDownRight className="w-3 h-3 ml-1" />
                        رد
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => onLike(comment.id!)}>
                        <Heart className={cn("w-4 h-4 ml-1", hasLiked ? "text-red-500 fill-current" : "text-muted-foreground")} />
                        <span className="text-xs">{comment.likes?.length || 0}</span>
                    </Button>
                </div>
            )}
          </div>

          {user && user.uid === comment.userId && !isEditing && (
            <AlertDialog>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-8 w-8">
                    <MoreVertical className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => onEdit(comment)}>
                    <Edit className="ml-2 h-4 w-4" />
                    <span>تعديل</span>
                  </DropdownMenuItem>
                   <AlertDialogTrigger asChild>
                     <DropdownMenuItem className="text-destructive">
                       <Trash2 className="ml-2 h-4 w-4" />
                       <span>حذف</span>
                     </DropdownMenuItem>
                  </AlertDialogTrigger>
                </DropdownMenuContent>
              </DropdownMenu>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>هل أنت متأكد من الحذف؟</AlertDialogTitle>
                  <AlertDialogDescription>
                    لا يمكن التراجع عن هذا الإجراء. سيتم حذف تعليقك (وجميع الردود عليه) بشكل نهائي.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>إلغاء</AlertDialogCancel>
                  <AlertDialogAction
                    className="bg-destructive hover:bg-destructive/90"
                    onClick={() => comment.id && onDelete(comment.id)}
                  >
                    {isDeleting === comment.id ? <Loader2 className="h-4 w-4 animate-spin" /> : "حذف"}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
        </div>
    )
}


export function CommentsScreen({ matchId, goBack, canGoBack, headerActions }: CommentsScreenProps) {
  const { user } = useAuth();
  const { db } = useFirestore();
  const [comments, setComments] = useState<MatchComment[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const commentsEndRef = useRef<HTMLDivElement>(null);

  const [editingCommentId, setEditingCommentId] = useState<string | null>(null);
  const [editingText, setEditingText] = useState('');
  const [isDeleting, setIsDeleting] = useState<string | null>(null);
  const [replyingTo, setReplyingTo] = useState<string | null>(null);

  const commentsColRef = collection(db, 'matches', String(matchId), 'comments');
  
  const fetchComments = useCallback(async () => {
    setLoading(true);
    const q = query(commentsColRef, orderBy('timestamp', 'asc'));
    
    const unsubscribe = onSnapshot(q, async (snapshot) => {
        const topLevelComments: MatchComment[] = [];

        // Use Promise.all to fetch subcollections concurrently
        const commentPromises = snapshot.docs.map(async (doc) => {
            const commentData = doc.data() as Omit<MatchComment, 'id' | 'replies' | 'likes'>;
            
            // Fetch replies
            const repliesRef = collection(db, 'matches', String(matchId), 'comments', doc.id, 'replies');
            const repliesQuery = query(repliesRef, orderBy('timestamp', 'asc'));
            const repliesSnapshot = await getDocs(repliesQuery);
            const replies = repliesSnapshot.docs.map(replyDoc => ({ id: replyDoc.id, ...replyDoc.data() } as MatchComment));

            // Fetch likes
            const likesRef = collection(db, 'matches', String(matchId), 'comments', doc.id, 'likes');
            const likesSnapshot = await getDocs(likesRef);
            const likes = likesSnapshot.docs.map(likeDoc => ({ id: likeDoc.id } as Like));

            return {
                id: doc.id,
                ...commentData,
                replies,
                likes
            };
        });

        const resolvedComments = await Promise.all(commentPromises);
        setComments(resolvedComments);
        setLoading(false);

    }, (error) => {
        console.error("Error fetching comments:", error);
        setLoading(false);
    });

    return unsubscribe;
  }, [matchId, db, commentsColRef]);


  useEffect(() => {
    let unsubscribe: (() => void) | undefined;
    fetchComments().then(unsub => unsubscribe = unsub);
    return () => unsubscribe && unsubscribe();
  }, [fetchComments]);


  useEffect(() => {
    if (!editingCommentId && !replyingTo) {
        commentsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [comments, editingCommentId, replyingTo]);

  const handleSendComment = async (text: string, parentId?: string | null) => {
    if (!text.trim() || !user || sending) return;

    setSending(true);
    try {
      const newCommentData = {
        text: text.trim(),
        userId: user.uid,
        userName: user.displayName,
        userPhoto: user.photoURL,
        timestamp: serverTimestamp(),
      };
      
      let collectionRef = commentsColRef;
      if (parentId) {
        collectionRef = collection(db, 'matches', String(matchId), 'comments', parentId, 'replies');
      }

      const newDocRef = await addDoc(collectionRef, newCommentData);
      
      if (parentId) {
        const parentComment = comments.find(c => c.id === parentId);
        if (parentComment && parentComment.userId !== user.uid) {
            const notificationRef = collection(db, 'users', parentComment.userId, 'notifications');
            await addDoc(notificationRef, {
                recipientId: parentComment.userId,
                senderId: user.uid,
                senderName: user.displayName,
                senderPhoto: user.photoURL,
                type: 'reply',
                matchId: matchId,
                commentId: parentId, // Notifying about the parent comment
                commentText: text.trim(),
                read: false,
                timestamp: serverTimestamp(),
            });
        }
      }
      
      if (replyingTo) {
          setReplyingTo(null);
      }
    } catch (error) {
      console.error("Error sending comment:", error);
    } finally {
      setSending(false);
    }
  };

  const handleEditClick = (c: MatchComment) => {
    if (!c.id) return;
    setEditingCommentId(c.id);
    setEditingText(c.text);
    setReplyingTo(null);
  };

  const handleCancelEdit = () => {
    setEditingCommentId(null);
    setEditingText('');
  };
  
  const handleReplyClick = (commentId: string) => {
    setReplyingTo(commentId);
    setEditingCommentId(null);
  }

  const handleUpdateComment = async () => {
    if (!editingCommentId || !editingText.trim() || sending) return;
    setSending(true);
    const commentDocRef = doc(db, 'matches', String(matchId), 'comments', editingCommentId);
    try {
      await updateDoc(commentDocRef, {
        text: editingText.trim(),
      });
      handleCancelEdit();
    } catch (error) {
      console.error("Error updating comment:", error);
    } finally {
      setSending(false);
    }
  };
  
  const handleDeleteComment = async (commentId: string) => {
    setIsDeleting(commentId);
    try {
        const batch = writeBatch(db);
        const commentRef = doc(db, 'matches', String(matchId), 'comments', commentId);

        // Delete all replies
        const repliesRef = collection(commentRef, 'replies');
        const repliesSnapshot = await getDocs(repliesRef);
        repliesSnapshot.forEach(replyDoc => batch.delete(replyDoc.ref));

        // Delete all likes
        const likesRef = collection(commentRef, 'likes');
        const likesSnapshot = await getDocs(likesRef);
        likesSnapshot.forEach(likeDoc => batch.delete(likeDoc.ref));

        // Delete the comment itself
        batch.delete(commentRef);

        await batch.commit();

    } catch(error) {
      console.error("Error deleting comment and subcollections:", error);
    } finally {
      setIsDeleting(null);
    }
  }

  const handleLikeComment = async (commentId: string) => {
      if (!user) return;
      const comment = comments.find(c => c.id === commentId);
      if (!comment) return;

      const likeRef = doc(db, 'matches', String(matchId), 'comments', commentId, 'likes', user.uid);
      const hasLiked = comment.likes?.some(like => like.id === user.uid);

      if (hasLiked) {
        await deleteDoc(likeRef);
      } else {
        await setDoc(likeRef, { userId: user.uid });
        
        // Create notification if liking and not the owner
        if (comment.userId !== user.uid) {
            const notificationRef = collection(db, 'users', comment.userId, 'notifications');
            await addDoc(notificationRef, {
                recipientId: comment.userId,
                senderId: user.uid,
                senderName: user.displayName,
                senderPhoto: user.photoURL,
                type: 'like',
                matchId: matchId,
                commentId: commentId,
                commentText: comment.text,
                read: false,
                timestamp: serverTimestamp(),
            });
        }
      }
  };

  const renderCommentTree = (comment: MatchComment, isReply: boolean = false) => (
    <div key={comment.id}>
        <CommentItem
            comment={comment}
            user={user}
            onEdit={handleEditClick}
            onDelete={handleDeleteComment}
            onReply={handleReplyClick}
            onLike={handleLikeComment}
            isDeleting={isDeleting}
            isEditing={editingCommentId === comment.id}
            onUpdate={handleUpdateComment}
            onCancelEdit={handleCancelEdit}
            sending={sending && editingCommentId === comment.id}
            editingText={editingText}
            setEditingText={setEditingText}
        />
        
        {replyingTo === comment.id && (
             <div className="ml-8 mt-2 pl-4 border-r-2">
                <CommentInput 
                    user={user}
                    sending={sending && !editingCommentId}
                    onSend={handleSendComment}
                    parentId={comment.id}
                    onCancel={() => setReplyingTo(null)}
                    autoFocus
                />
             </div>
        )}
        
        {comment.replies && comment.replies.length > 0 && (
            <div className="ml-8 mt-4 space-y-4 pl-4 border-r-2">
                {comment.replies.map(reply => renderCommentTree(reply, true))}
            </div>
        )}
    </div>
  );


  return (
    <div className="flex h-full flex-col bg-background">
      <ScreenHeader title="التعليقات" onBack={goBack} canGoBack={canGoBack} actions={headerActions} />
      
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {loading ? (
          Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex items-start gap-3">
              <Skeleton className="h-10 w-10 rounded-full" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-10 w-full" />
              </div>
            </div>
          ))
        ) : comments.length > 0 ? (
          comments.map((c) => renderCommentTree(c))
        ) : (
          <p className="text-center text-muted-foreground pt-8">لا توجد تعليقات بعد. كن أول من يعلق!</p>
        )}
        <div ref={commentsEndRef} />
      </div>

      {!editingCommentId && !replyingTo && (
        <CommentInput user={user} sending={sending && !editingCommentId} onSend={handleSendComment} />
      )}
    </div>
  );
}
