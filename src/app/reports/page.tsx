'use client';

import * as React from 'react';
import { useState, useEffect, useMemo } from 'react';
import { useFirestore, useCollection, useMemoFirebase, useUser } from '@/firebase';
import { collection, query, where, orderBy, Timestamp } from 'firebase/firestore';
import { format, subDays, startOfDay, endOfDay } from 'date-fns';
import { es } from 'date-fns/locale';
import { Calendar as CalendarIcon, Loader2, CalendarDays, Coins, Activity, MessageSquare } from 'lucide-react';
import { DateRange } from 'react-day-picker';

import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { getCategorizedConversations } from '@/app/actions';
import { useToast } from '@/hooks/use-toast';

type Conversation = {
    id: string;
    userId: string;
    questionText: string;
    answerText: string;
    timestamp: Timestamp;
    inputTokens?: number;
    outputTokens?: number;
    cost?: number;
};

function ConversationItem({ conv }: { conv: Conversation }) {
    const totalTokens = (conv.inputTokens || 0) + (conv.outputTokens || 0);
    const cost = conv.cost || 0;

    return (
        <AccordionItem value={conv.id} key={conv.id} className="border-none">
            <AccordionTrigger className="hover:no-underline py-2">
                <div className="flex justify-between items-center w-full pr-4">
                    <div className="flex flex-col items-start gap-1 overflow-hidden">
                        <span className="truncate font-medium text-left text-sm w-full">{conv.questionText}</span>
                        <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
                             <span className="flex items-center gap-1">
                                <Activity className="h-3 w-3" />
                                {totalTokens} tokens
                            </span>
                            <span className="flex items-center gap-1">
                                <Coins className="h-3 w-3" />
                                ${cost.toFixed(6)}
                            </span>
                        </div>
                    </div>
                    <span className="text-xs text-muted-foreground text-right flex-shrink-0 ml-4">
                        {conv.timestamp ? format(conv.timestamp.toDate(), 'p', { locale: es }) : ''}
                    </span>
                </div>
            </AccordionTrigger>
            <AccordionContent className="p-4 bg-muted/30 rounded-md mt-1">
                 <div
                    className="prose prose-sm max-w-none"
                    dangerouslySetInnerHTML={{ __html: conv.answerText }}
                />
            </AccordionContent>
        </AccordionItem>
    );
}

export default function ReportsPage() {
    const firestore = useFirestore();
    const { user, isUserLoading } = useUser();
    const { toast } = useToast();
    
    // Default filter: last 7 days
    const [date, setDate] = useState<DateRange | undefined>({
        from: subDays(new Date(), 7),
        to: new Date(),
    });
    
    const [sortOrder, setSortOrder] = useState<'desc' | 'asc' | 'theme'>('desc');
    const [groupedConversations, setGroupedConversations] = useState<Record<string, Conversation[]> | null>(null);
    const [isCategorizing, setIsCategorizing] = useState(false);

    const conversationsQuery = useMemoFirebase(() => {
        if (!firestore || !user) return null;

        const constraints = [];

        if (date?.from) {
            constraints.push(where('timestamp', '>=', startOfDay(date.from)));
        }
        if (date?.to) {
            constraints.push(where('timestamp', '<=', endOfDay(date.to)));
        }

        constraints.push(orderBy('timestamp', sortOrder === 'asc' ? 'asc' : 'desc'));
        
        return query(collection(firestore, 'conversations'), ...constraints);
    }, [firestore, user, date, sortOrder]);

    const { data: conversations, isLoading: isLoadingCollection } = useCollection(conversationsQuery);
    const typedConversations = conversations as Conversation[] | null;

    // Calculate Summary Stats
    const stats = useMemo(() => {
        if (!typedConversations) return { totalQuestions: 0, totalTokens: 0, totalCost: 0 };
        
        return typedConversations.reduce((acc, conv) => {
            return {
                totalQuestions: acc.totalQuestions + 1,
                totalTokens: acc.totalTokens + (conv.inputTokens || 0) + (conv.outputTokens || 0),
                totalCost: acc.totalCost + (conv.cost || 0),
            };
        }, { totalQuestions: 0, totalTokens: 0, totalCost: 0 });
    }, [typedConversations]);

    useEffect(() => {
        if (sortOrder === 'theme' && typedConversations && typedConversations.length > 0) {
            const handleCategorization = async () => {
                setIsCategorizing(true);
                setGroupedConversations(null);
                
                const serializableConversations = typedConversations.map(c => ({
                    ...c,
                    timestamp: c.timestamp.toDate().toISOString(),
                }));

                const result = await getCategorizedConversations(serializableConversations);
                
                if (result.success && result.data) {
                    const conversationMap = new Map(typedConversations.map(c => [c.id, c]));
                    const grouped: Record<string, Conversation[]> = {};
                    const themeOrder: string[] = [];

                    for (const theme in result.data) {
                        themeOrder.push(theme);
                        const ids = result.data[theme];
                        grouped[theme] = ids.map(id => conversationMap.get(id)!).filter(Boolean);
                    }
                    
                    themeOrder.sort((a, b) => {
                        if (a.toLowerCase() === 'otros temas') return 1;
                        if (b.toLowerCase() === 'otros temas') return -1;
                        return a.localeCompare(b);
                    });
                    
                    const orderedGrouped: Record<string, Conversation[]> = {};
                    for (const theme of themeOrder) {
                        if (grouped[theme]) {
                           orderedGrouped[theme] = grouped[theme];
                        }
                    }

                    setGroupedConversations(orderedGrouped);
                } else {
                    toast({
                        variant: "destructive",
                        title: "Error de Categorización",
                        description: result.error || "No se pudieron agrupar las conversaciones por tema.",
                    });
                }
                setIsCategorizing(false);
            };
            handleCategorization();
        } else {
            setGroupedConversations(null);
        }
    }, [sortOrder, typedConversations, toast]);

    const getGroupedByDate = () => {
        if (!typedConversations) return {};
        const groups: Record<string, Conversation[]> = {};
        
        typedConversations.forEach(conv => {
            const dateKey = format(conv.timestamp.toDate(), "eeee, d 'de' MMMM", { locale: es });
            if (!groups[dateKey]) groups[dateKey] = [];
            groups[dateKey].push(conv);
        });
        
        return groups;
    };

    const isLoading = isUserLoading || isLoadingCollection;
    const showLoader = isLoading || isCategorizing;
    const dateGroups = sortOrder !== 'theme' ? getGroupedByDate() : null;

    return (
        <div className="flex flex-col items-center min-h-screen bg-background p-4 md:p-8">
            <Card className="w-full max-w-5xl mx-auto shadow-lg border-t-4 border-t-primary">
                <CardHeader>
                    <div className="flex justify-between items-start">
                        <div>
                            <CardTitle className="text-3xl font-bold">Reporte de Conversaciones</CardTitle>
                            <CardDescription>
                                Analiza las interacciones y el costo operativo de tu asistente.
                            </CardDescription>
                        </div>
                        <Button variant="outline" size="sm" onClick={() => window.print()} className="hidden md:flex">
                            Imprimir Reporte
                        </Button>
                    </div>
                </CardHeader>
                <CardContent className="space-y-8">
                    
                    {/* Summary Dashboard */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <Card className="bg-primary/5 border-primary/20">
                            <CardContent className="pt-6">
                                <div className="flex items-center gap-3">
                                    <div className="p-2 bg-primary/10 rounded-full">
                                        <MessageSquare className="h-5 w-5 text-primary" />
                                    </div>
                                    <div>
                                        <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Preguntas</p>
                                        <p className="text-2xl font-bold">{stats.totalQuestions}</p>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                        <Card className="bg-primary/5 border-primary/20">
                            <CardContent className="pt-6">
                                <div className="flex items-center gap-3">
                                    <div className="p-2 bg-primary/10 rounded-full">
                                        <Activity className="h-5 w-5 text-primary" />
                                    </div>
                                    <div>
                                        <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Tokens Totales</p>
                                        <p className="text-2xl font-bold">{stats.totalTokens.toLocaleString()}</p>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                        <Card className="bg-primary/5 border-primary/20">
                            <CardContent className="pt-6">
                                <div className="flex items-center gap-3">
                                    <div className="p-2 bg-primary/10 rounded-full">
                                        <Coins className="h-5 w-5 text-primary" />
                                    </div>
                                    <div>
                                        <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Costo Estimado</p>
                                        <p className="text-2xl font-bold">${stats.totalCost.toFixed(4)}</p>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    </div>

                    <div className="flex flex-col md:flex-row gap-4 p-4 border rounded-lg bg-muted/30">
                        {/* Date Picker */}
                        <div className="flex-1 space-y-2">
                             <label className="text-xs font-bold uppercase text-muted-foreground">Rango de Fechas</label>
                            <Popover>
                                <PopoverTrigger asChild>
                                    <Button
                                        id="date"
                                        variant={'outline'}
                                        className={cn(
                                            'w-full justify-start text-left font-normal bg-background',
                                            !date && 'text-muted-foreground'
                                        )}
                                    >
                                        <CalendarIcon className="mr-2 h-4 w-4" />
                                        {date?.from ? (
                                            date.to ? (
                                                <>
                                                    {format(date.from, 'dd/MM/yyyy')} -{' '}
                                                    {format(date.to, 'dd/MM/yyyy')}
                                                </>
                                            ) : (
                                                format(date.from, 'dd/MM/yyyy')
                                            )
                                        ) : (
                                            <span>Selecciona un rango</span>
                                        )}
                                    </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-auto p-0" align="start">
                                    <Calendar
                                        initialFocus
                                        mode="range"
                                        defaultMonth={date?.from}
                                        selected={date}
                                        onSelect={setDate}
                                        numberOfMonths={2}
                                        locale={es}
                                    />
                                </PopoverContent>
                            </Popover>
                        </div>
                        {/* Sort Order Select */}
                        <div className="flex-1 space-y-2">
                             <label className="text-xs font-bold uppercase text-muted-foreground">Visualización</label>
                            <Select onValueChange={(value: 'desc' | 'asc' | 'theme') => setSortOrder(value)} defaultValue={sortOrder}>
                                <SelectTrigger className="w-full bg-background">
                                    <SelectValue placeholder="Ordenar por..." />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="desc">Más Recientes (por día)</SelectItem>
                                    <SelectItem value="asc">Más Antiguos (por día)</SelectItem>
                                    <SelectItem value="theme">Agrupado por Tema (IA)</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                         <div className="flex items-end">
                            <Button onClick={() => setDate(undefined)} variant="ghost" className="text-xs">
                                Limpiar Filtros
                            </Button>
                        </div>
                    </div>

                    <Separator />

                    <div className="space-y-4">
                        {showLoader ? (
                            <div className="flex flex-col items-center justify-center p-10">
                                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                                <p className="mt-2 text-muted-foreground text-sm">
                                    {isCategorizing ? 'Analizando temas con IA...' : 'Cargando conversaciones...'}
                                </p>
                            </div>
                        ) : !typedConversations || typedConversations.length === 0 ? (
                            <div className="text-center py-20 border-2 border-dashed rounded-xl">
                                <p className="text-muted-foreground">No se encontraron conversaciones para este período.</p>
                            </div>
                        ) : sortOrder === 'theme' && groupedConversations ? (
                            <Accordion type="multiple" className="w-full space-y-3">
                                {Object.entries(groupedConversations).map(([theme, convs]) => (
                                    <AccordionItem value={theme} key={theme} className="border rounded-lg px-4 bg-card shadow-sm overflow-hidden">
                                        <AccordionTrigger className="py-4 text-base font-semibold hover:no-underline">
                                            <div className="flex items-center gap-2">
                                                <span className="bg-primary/10 text-primary px-2 py-0.5 rounded text-xs">TEMA</span>
                                                <span className="capitalize">{theme}</span>
                                                <span className="text-[10px] font-normal text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
                                                    {convs.length}
                                                </span>
                                            </div>
                                        </AccordionTrigger>
                                        <AccordionContent className="pb-4">
                                            <Accordion type="single" collapsible className="w-full space-y-1">
                                                {convs.map((conv) => (
                                                    <ConversationItem conv={conv} key={conv.id}/>
                                                ))}
                                            </Accordion>
                                        </AccordionContent>
                                    </AccordionItem>
                                ))}
                            </Accordion>
                        ) : (
                            <Accordion type="multiple" className="w-full space-y-3">
                                {Object.entries(dateGroups || {}).map(([dateLabel, convs]) => (
                                    <AccordionItem value={dateLabel} key={dateLabel} className="border rounded-lg px-4 bg-card shadow-sm overflow-hidden">
                                        <AccordionTrigger className="py-4 text-base font-semibold hover:no-underline capitalize">
                                            <div className="flex items-center gap-2">
                                                <CalendarDays className="h-4 w-4 text-primary" />
                                                <span>{dateLabel}</span>
                                                <span className="text-[10px] font-normal text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
                                                    {convs.length}
                                                </span>
                                            </div>
                                        </AccordionTrigger>
                                        <AccordionContent className="pb-4">
                                            <Accordion type="single" collapsible className="w-full space-y-1">
                                                {convs.map((conv) => (
                                                    <ConversationItem conv={conv} key={conv.id}/>
                                                ))}
                                            </Accordion>
                                        </AccordionContent>
                                    </AccordionItem>
                                ))}
                            </Accordion>
                        )}
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
