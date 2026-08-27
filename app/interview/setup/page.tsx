'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/lib/supabase-client';
import { APP_CONFIG, type RoleId } from '@/lib/config';
import type { Question } from '@/lib/types';
import { ArrowLeft, ArrowRight, Mic, Phone, Mail, User, RefreshCw, CheckCircle2, Lock, Sparkles } from 'lucide-react';

export default function SetupPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [selectedRole, setSelectedRole] = useState<RoleId | null>(null);
  const [question, setQuestion] = useState<Question | null>(null);
  const [loadingQuestion, setLoadingQuestion] = useState(false);
  const [name, setName] = useState('');
  const [contact, setContact] = useState('');
  const [creating, setCreating] = useState(false);
  const [hasMonthlyAccess, setHasMonthlyAccess] = useState(false);

  useEffect(() => {
    // Load saved identity from localStorage
    const savedName = localStorage.getItem('iq_name');
    const savedContact = localStorage.getItem('iq_contact');
    if (savedName) setName(savedName);
    if (savedContact) setContact(savedContact);

    // Check monthly access
    const accessExpiry = localStorage.getItem('iq_access_expires_at');
    if (accessExpiry && new Date(accessExpiry) > new Date()) {
      setHasMonthlyAccess(true);
    }
  }, []);

  async function pickRole(role: RoleId) {
    setSelectedRole(role);
    setQuestion(null);
    setLoadingQuestion(true);
    const { data, error } = await supabase
      .from('questions')
      .select('id, role, question_text, category')
      .eq('role', role)
      .limit(50);
    if (error) {
      toast({ title: 'Could not load questions', description: error.message, variant: 'destructive' });
      setLoadingQuestion(false);
      return;
    }
    if (data && data.length > 0) {
      const random = data[Math.floor(Math.random() * data.length)];
      setQuestion(random as Question);
    }
    setLoadingQuestion(false);
  }

  async function newQuestion() {
    if (!selectedRole) return;
    setLoadingQuestion(true);
    const { data, error } = await supabase
      .from('questions')
      .select('id, role, question_text, category')
      .eq('role', selectedRole)
      .limit(50);
    if (data && data.length > 0) {
      let next = data[Math.floor(Math.random() * data.length)];
      if (question && data.length > 1) {
        while (next.id === question.id) {
          next = data[Math.floor(Math.random() * data.length)];
        }
      }
      setQuestion(next as Question);
    }
    setLoadingQuestion(false);
  }

  async function startRecording() {
    if (!selectedRole || !question) {
      toast({ title: 'Select a role and question first', variant: 'destructive' });
      return;
    }
    if (!name.trim() || !contact.trim()) {
      toast({ title: 'Enter your name and contact', description: 'Phone number or email required', variant: 'destructive' });
      return;
    }

    // Check if this is not their first attempt and they need payment
    if (!hasMonthlyAccess) {
      const { count } = await supabase
        .from('sessions')
        .select('id', { count: 'exact', head: true })
        .eq('contact', contact.trim());
      
      if (count && count > 0) {
        // Not first attempt - need payment before recording
        toast({
          title: 'Payment required',
          description: 'Your first attempt is free. For additional attempts, unlock with a single report or monthly plan.',
          variant: 'destructive',
        });
        router.push(`/interview/paywall?role=${selectedRole}`);
        return;
      }
    }

    setCreating(true);
    // Save identity
    localStorage.setItem('iq_name', name.trim());
    localStorage.setItem('iq_contact', contact.trim());

    // Create session
    const { data, error } = await supabase
      .from('sessions')
      .insert({
        name: name.trim(),
        contact: contact.trim(),
        role: selectedRole,
        question_id: question.id,
      })
      .select('id')
      .single();

    if (error || !data) {
      toast({ title: 'Could not start session', description: error?.message, variant: 'destructive' });
      setCreating(false);
      return;
    }

    router.push(`/interview/record?session=${data.id}`);
  }

  return (
    <div className="min-h-screen bg-secondary/20">
      {/* Nav */}
      <nav className="border-b bg-white">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
              <Mic className="h-4 w-4 text-white" />
            </div>
            <span className="font-bold">{APP_CONFIG.name}</span>
          </Link>
          <Link href="/">
            <Button variant="ghost" size="sm" className="gap-1.5">
              <ArrowLeft className="h-4 w-4" /> Home
            </Button>
          </Link>
        </div>
      </nav>

      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
        {/* Step indicator */}
        <div className="flex items-center gap-2 mb-8 text-sm">
          <div className="flex items-center gap-2 text-primary font-medium">
            <div className="w-6 h-6 rounded-full bg-primary text-white flex items-center justify-center text-xs">1</div>
            Setup
          </div>
          <div className="h-px w-8 bg-border" />
          <div className="flex items-center gap-2 text-muted-foreground">
            <div className="w-6 h-6 rounded-full bg-muted flex items-center justify-center text-xs">2</div>
            Record
          </div>
          <div className="h-px w-8 bg-border" />
          <div className="flex items-center gap-2 text-muted-foreground">
            <div className="w-6 h-6 rounded-full bg-muted flex items-center justify-center text-xs">3</div>
            Report
          </div>
        </div>

        {hasMonthlyAccess && (
          <div className="mb-6 flex items-center gap-2 px-4 py-3 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-700 text-sm">
            <CheckCircle2 className="h-4 w-4" /> You have an active monthly plan — all reports are unlocked.
          </div>
        )}

        {/* Role selection */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="text-xl">Choose your target role</CardTitle>
            <CardDescription>Select the role you're preparing for. We'll tailor the feedback rubric accordingly.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid sm:grid-cols-3 gap-3">
              {APP_CONFIG.roles.map((role) => (
                <button
                  key={role.id}
                  onClick={() => pickRole(role.id)}
                  className={`text-left p-4 rounded-lg border-2 transition-all ${
                    selectedRole === role.id
                      ? 'border-primary bg-primary/5 ring-2 ring-primary/20'
                      : 'border-border hover:border-primary/40 hover:bg-secondary/50'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-semibold">{role.label}</span>
                    {selectedRole === role.id && <CheckCircle2 className="h-4 w-4 text-primary" />}
                  </div>
                  <p className="text-xs text-muted-foreground">{role.description}</p>
                </button>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Question display */}
        {selectedRole && (
          <Card className="mb-6 animate-fade-in-up">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-primary" />
                  <CardTitle className="text-lg">Your Interview Question</CardTitle>
                </div>
                <Button variant="ghost" size="sm" onClick={newQuestion} disabled={loadingQuestion} className="gap-1.5">
                  <RefreshCw className={`h-3.5 w-3.5 ${loadingQuestion ? 'animate-spin' : ''}`} /> New question
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {loadingQuestion ? (
                <div className="h-20 flex items-center justify-center text-muted-foreground">
                  Loading question...
                </div>
              ) : question ? (
                <div>
                  <Badge variant="secondary" className="mb-3 capitalize">{question.category}</Badge>
                  <p className="text-lg font-medium leading-relaxed">{question.question_text}</p>
                </div>
              ) : (
                <p className="text-muted-foreground">No questions available for this role.</p>
              )}
            </CardContent>
          </Card>
        )}

        {/* Identity form */}
        {selectedRole && question && (
          <Card className="mb-6 animate-fade-in-up">
            <CardHeader>
              <CardTitle className="text-lg">Tell us about you</CardTitle>
              <CardDescription>We'll save this so you don't have to re-enter it next time. No password needed.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name" className="flex items-center gap-1.5">
                  <User className="h-3.5 w-3.5" /> Name
                </Label>
                <Input
                  id="name"
                  placeholder="Your full name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="contact" className="flex items-center gap-1.5">
                  <Phone className="h-3.5 w-3.5" /> Phone or Email
                </Label>
                <Input
                  id="contact"
                  placeholder="Phone number or email address"
                  value={contact}
                  onChange={(e) => setContact(e.target.value)}
                />
                <p className="text-xs text-muted-foreground flex items-center gap-1">
                  <Mail className="h-3 w-3" /> Used to link your sessions together. No verification needed.
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Start button */}
        {selectedRole && question && (
          <div className="flex flex-col sm:flex-row items-center gap-3">
            <Button size="lg" className="w-full sm:w-auto gap-2 text-base h-12 px-8" onClick={startRecording} disabled={creating}>
              {creating ? 'Starting...' : <>Start Recording <ArrowRight className="h-5 w-5" /></>}
            </Button>
            {!hasMonthlyAccess && (
              <p className="text-xs text-muted-foreground flex items-center gap-1">
                <Lock className="h-3 w-3" /> First attempt is free. Detailed reports start at ₹99.
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
