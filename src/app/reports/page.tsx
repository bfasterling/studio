'use client';

import * as React from 'react';
import { useState, useEffect } from 'react';
import { useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, where, orderBy, Timestamp } from 'firebase/firestore';
import { format, subDays, startOfDay, endOfDay, isSameDay } from 'date-fns';
import { es } from 'date-fns/locale';
import { Calendar as CalendarIcon, Loader2, CalendarDays } from 'lucide-react';
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
};

function ConversationItem({ conv }: { conv: Conversation }) {
    return (
        <AccordionItem value={conv.id} key={conv.id} className="border-none">
            <AccordionTrigger className="hover:no-underline py-2">
                <div className="flex justify-between items-center w-full pr-4">
                    <span className="truncate font-medium text-left text-sm">{conv.questionText}</span>
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
        if (!firestore) return null;

        const constraints = [];

        if (date?.from) {
            constraints.push(where('timestamp', '>=', startOfDay(date.from)));
        }
        if (date?.to) {
            constraints.push(where('timestamp', '<=', endOfDay(date.to)));
        }

        constraints.push(orderBy('timestamp', sortOrder === 'asc' ? 'asc' : 'desc'));
        
        return query(collection(firestore, 'conversations'), ...constraints);
    }, [firestore, date, sortOrder]);

    const { data: conversations, isLoading } = useCollection(conversationsQuery);
    const typedConversations = conversations as Conversation[] | null;

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

    // Helper to group by date for the default view
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

    const showLoader = isLoading || isCategorizing;
    const dateGroups = sortOrder !== 'theme' ? getGroupedByDate() : null;

    return (
        <div className="flex flex-col items-center min-h-screen bg-background p-4 md:p-8">
            <Card className="w-full max-w-5xl mx-auto shadow-lg">
                <CardHeader>
                    <CardTitle className="text-3xl font-bold">Reporte de Conversaciones</CardTitle>
                    <CardDescription>
                        Analiza las interacciones de los usuarios con el asistente de IA.
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                    <div className="flex flex-col md:flex-row gap-4 p-4 border rounded-lg bg-muted/50">
                        {/* Date Picker */}
                        <div className="flex-1 space-y-2">
                             <label className="text-sm font-medium">Rango de Fechas</label>
                            <Popover>
                                <PopoverTrigger asChild>
                                    <Button
                                        id="date"
                                        variant={'outline'}
                                        className={cn(
                                            'w-full justify-start text-left font-normal',
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
                             <label className="text-sm font-medium">Visualización / Orden</label>
                            <Select onValueChange={(value: 'desc' | 'asc' | 'theme') => setSortOrder(value)} defaultValue={sortOrder}>
                                <SelectTrigger className="w-full">
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
                            <Button onClick={() => setDate(undefined)} variant="ghost">
                                Limpiar Filtros
                            </Button>
                        </div>
                    </div>

                    <Separator />

                    <div className="space-y-4">
                        {showLoader ? (
                            <div className="flex flex-col items-center justify-center p-10">
                                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                                <p className="mt-2 text-muted-foreground">
                                    {isCategorizing ? 'Agrupando por tema...' : 'Cargando conversaciones...'}
                                </p>
                            </div>
                        ) : !typedConversations || typedConversations.length === 0 ? (
                            <div className="text-center py-10">
                                <p className="text-muted-foreground">No se encontraron conversaciones para los filtros seleccionados.</p>
                            </div>
                        ) : sortOrder === 'theme' && groupedConversations ? (
                            // Grouped by theme view (IA)
                            <Accordion type="multiple" className="w-full">
                                {Object.entries(groupedConversations).map(([theme, convs]) => (
                                    <AccordionItem value={theme} key={theme} className="border rounded-lg mb-4 px-4 bg-card shadow-sm">
                                        <AccordionTrigger className="py-4 text-lg font-semibold hover:no-underline">
                                            <div className="flex items-center gap-2">
                                                <span>{theme}</span>
                                                <span className="text-xs font-normal text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
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
                            // Default view: Grouped by Date
                            <Accordion type="multiple" className="w-full">
                                {Object.entries(dateGroups || {}).map(([dateLabel, convs]) => (
                                    <AccordionItem value={dateLabel} key={dateLabel} className="border rounded-lg mb-4 px-4 bg-card shadow-sm">
                                        <AccordionTrigger className="py-4 text-lg font-semibold hover:no-underline capitalize">
                                            <div className="flex items-center gap-2">
                                                <CalendarDays className="h-5 w-5 text-primary" />
                                                <span>{dateLabel}</span>
                                                <span className="text-xs font-normal text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
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
