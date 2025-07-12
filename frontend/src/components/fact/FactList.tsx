import React, { useState, useEffect } from 'react';
import { 
  Card, 
  CardContent, 
  CardHeader, 
  CardTitle,
  CardDescription 
} from '../ui/card';
import { 
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../ui/table';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Skeleton } from '../ui/skeleton';
import { useToast } from '../common/ToastContainer';
import { registryService } from '../../services';
import type { Registry } from '../../types';
import { 
  Calendar,
  Building,
  Tag,
  DollarSign,
  MessageSquare,
  Trash2,
  Edit,
  Eye,
  RefreshCw
} from 'lucide-react';

interface ExtendedRegistry extends Registry {
  period_name?: string;
  financial_center_name?: string;
  cost_center_name?: string;
  nomenclature_name?: string;
}

export const FactList: React.FC = () => {
  const [facts, setFacts] = useState<ExtendedRegistry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const toast = useToast();

  useEffect(() => {
    loadFacts();
  }, []);

  const loadFacts = async () => {
    try {
      setIsLoading(true);
      const data = await registryService.getFacts({ limit: 50 });
      setFacts(data);
    } catch (error) {
      console.error('Ошибка загрузки расходов:', error);
      toast.error('Ошибка', error instanceof Error ? error.message : 'Не удалось загрузить список расходов');
    } finally {
      setIsLoading(false);
    }
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await loadFacts();
    setIsRefreshing(false);
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('ru-RU', {
      style: 'currency',
      currency: 'RUB',
    }).format(amount);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('ru-RU');
  };

  const LoadingSkeleton = () => (
    <div className="space-y-3">
      {[...Array(5)].map((_, i) => (
        <div key={i} className="flex space-x-4">
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-4 w-40" />
          <Skeleton className="h-4 w-24" />
        </div>
      ))}
    </div>
  );

  return (
    <Card className="border-l-4 border-l-red-500">
      <CardHeader className="bg-gradient-to-r from-red-50 to-orange-50">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <div className="h-10 w-10 bg-red-100 rounded-full flex items-center justify-center">
                <DollarSign className="h-5 w-5 text-red-600" />
              </div>
              История операций
            </CardTitle>
            <CardDescription>
              Последние фактические расходы и доходы
            </CardDescription>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            disabled={isRefreshing}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${isRefreshing ? 'animate-spin' : ''}`} />
            Обновить
          </Button>
        </div>
      </CardHeader>
      
      <CardContent>
        {isLoading ? (
          <LoadingSkeleton />
        ) : facts.length === 0 ? (
          <div className="text-center py-8">
            <DollarSign className="h-12 w-12 text-slate-300 mx-auto mb-4" />
            <p className="text-slate-500 mb-2">Расходы не найдены</p>
            <p className="text-sm text-slate-400">
              Добавьте первую операцию, чтобы увидеть ее здесь
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <Badge variant="secondary" className="text-sm">
                Всего операций: {facts.length}
              </Badge>
              <Badge variant="outline" className="text-sm">
                Сумма: {formatCurrency(facts.reduce((sum, fact) => sum + fact.cost_sum, 0))}
              </Badge>
            </div>
            
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-24">
                      <div className="flex items-center gap-1">
                        <Calendar className="h-4 w-4" />
                        Дата
                      </div>
                    </TableHead>
                    <TableHead>Период</TableHead>
                    <TableHead>
                      <div className="flex items-center gap-1">
                        <Building className="h-4 w-4" />
                        ФЦ
                      </div>
                    </TableHead>
                    <TableHead>МВЗ</TableHead>
                    <TableHead>
                      <div className="flex items-center gap-1">
                        <Tag className="h-4 w-4" />
                        Номенклатура
                      </div>
                    </TableHead>
                    <TableHead className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <DollarSign className="h-4 w-4" />
                        Сумма
                      </div>
                    </TableHead>
                    <TableHead>
                      <div className="flex items-center gap-1">
                        <MessageSquare className="h-4 w-4" />
                        Комментарий
                      </div>
                    </TableHead>
                    <TableHead className="w-20">Действия</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {facts.map((fact, index) => (
                    <TableRow key={fact.registry_id || index} className="hover:bg-slate-50">
                      <TableCell className="font-medium">
                        {formatDate(fact.operation_dttm)}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-xs">
                          {fact.period_name || 'Не указан'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <span className="text-sm text-slate-600">
                          {fact.financial_center_name || '—'}
                        </span>
                      </TableCell>
                      <TableCell>
                        <span className="text-sm text-slate-600">
                          {fact.cost_center_name || '—'}
                        </span>
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary" className="text-xs">
                          {fact.nomenclature_name || 'Не указано'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right font-semibold text-red-600">
                        {formatCurrency(fact.cost_sum)}
                      </TableCell>
                      <TableCell>
                        {fact.comment_description ? (
                          <span 
                            className="text-sm text-slate-600 cursor-help" 
                            title={fact.comment_description}
                          >
                            {fact.comment_description.length > 30 
                              ? `${fact.comment_description.substring(0, 30)}...` 
                              : fact.comment_description}
                          </span>
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                            <Eye className="h-3 w-3" />
                          </Button>
                          <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                            <Edit className="h-3 w-3" />
                          </Button>
                          <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-red-500 hover:text-red-700">
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};