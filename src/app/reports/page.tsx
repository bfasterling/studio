'use client';

import * as React from 'react';
import { useState, useEffect } from 'react';
import { useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, where, orderBy, Timestamp } from 'firebase/firestore';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { Calendar as CalendarIcon, Loader2 } from 'lucide-react';
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
        <AccordionItem value={conv.id} key={conv.id}>
            <AccordionTrigger>
                <div className="flex justify-between items-center w-full pr-4">
                    <span className="truncate font-medium text-left">{conv.questionText}</span>
                    <span className="text-sm text-muted-foreground text-right flex-shrink-0 ml-4">
                        {conv.timestamp ? format(conv.timestamp.toDate(), 'PPpp', { locale: es }) : 'Fecha desconocida'}
                    </span>
                </div>
            </AccordionTrigger>
            <AccordionContent className="p-4 bg-muted/30 rounded-b-md">
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
    const [date, setDate] = useState<DateRange | undefined>();
    const [sortOrder, setSortOrder] = useState<'desc' | 'asc' | 'theme'>('desc');
    
    const [groupedConversations, setGroupedConversations] = useState<Record<string, Conversation[]> | null>(null);
    const [isCategorizing, setIsCategorizing] = useState(false);

    const conversationsQuery = useMemoFirebase(() => {
        if (!firestore) return null;

        const constraints = [];

        if (date?.from) {
            constraints.push(where('timestamp', '>=', date.from));
        }
        if (date?.to) {
            const toDate = new Date(date.to);
            toDate.setHours(23, 59, 59, 999);
            constraints.push(where('timestamp', '<=', toDate));
        }

        constraints.push(orderBy('timestamp', 'desc')); // Always fetch newest first
        
        return query(collection(firestore, 'conversations'), ...constraints);
    }, [firestore, date]);

    const { data: conversations, isLoading } = useCollection(conversationsQuery);
    const typedConversations = conversations as Conversation[] | null;

    useEffect(() => {
        if (sortOrder === 'theme' && typedConversations && typedConversations.length > 0) {
            const handleCategorization = async () => {
                setIsCategorizing(true);
                setGroupedConversations(null);
                
                // Manually serialize Firestore Timestamps to ISO strings before passing to the Server Action.
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
                    
                    // Sort themes, putting "Otros temas" at the end
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

    const getProcessedConversations = () => {
        if (!typedConversations) return [];
        if (sortOrder === 'asc') {
            return [...typedConversations].reverse();
        }
        return typedConversations;
    };
    
    const finalConversations = getProcessedConversations();
    const showLoader = isLoading || isCategorizing;

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
                                                    {format(date.from, 'LLL dd, y')} -{' '}
                                                    {format(date.to, 'LLL dd, y')}
                                                </>
                                            ) : (
                                                format(date.from, 'LLL dd, y')
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
                             <label className="text-sm font-medium">Ordenar Por</label>
                            <Select onValueChange={(value: 'desc' | 'asc' | 'theme') => setSortOrder(value)} defaultValue={sortOrder}>
                                <SelectTrigger className="w-full">
                                    <SelectValue placeholder="Ordenar por..." />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="desc">Más Recientes</SelectItem>
                                    <SelectItem value="asc">Más Antiguos</SelectItem>
                                    <SelectItem value="theme">Por Tema</SelectItem>
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
                            // Grouped by theme view
                            <div>
                                {Object.entries(groupedConversations).map(([theme, convs]) => (
                                    <div key={theme}>
                                        <h3 className="text-xl font-semibold mt-6 mb-2 px-1 text-primary/90">{theme}</h3>
                                        {convs.length > 0 ? (
                                            <Accordion type="single" collapsible className="w-full">
                                                {convs.map((conv) => (
                                                    <ConversationItem conv={conv} key={conv.id}/>
                                                ))}
                                            </Accordion>
                                        ) : (
                                            <p className="text-muted-foreground px-1">No hay conversaciones para este tema.</p>
                                        )}
                                    </div>
                                ))}
                            </div>
                        ) : (
                            // Default list view
                            <Accordion type="single" collapsible className="w-full">
                                {finalConversations.map((conv) => (
                                    <ConversationItem conv={conv} key={conv.id}/>
                                ))}
                            </Accordion>
                        )}
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
