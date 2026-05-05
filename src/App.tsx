/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect, useMemo, Dispatch, SetStateAction } from 'react';
import { supabase } from './supabase';
import { 
  LayoutDashboard, 
  ChefHat, 
  Wallet, 
  Clock, 
  Tag, 
  ShoppingBag,
  Plus,
  Trash2,
  AlertCircle,
  TrendingUp,
  TrendingDown
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { AppState, Recipe, Sale, FixedCosts, LaborConfig, Ingredient } from './types';

// Tab Components (to be implemented)
// For now, I'll keep them as simple components inside or import them

const INITIAL_STATE: AppState = {
  recipes: [],
  fixedCosts: {
    gas: 0,
    energy: 0,
    transport: 0,
    internet: 0,
    others: 0,
    monthlyProductionUnits: 1,
  },
  laborConfig: {
    hourlyRate: 0,
  },
  sales: [],
};

type TabType = 'dashboard' | 'production' | 'fixed_costs' | 'labor' | 'pricing' | 'sales';

export default function App() {
  const [state, setState] = useState<AppState>(INITIAL_STATE);
  const [activeTab, setActiveTab] = useState<TabType>('dashboard');
  const [isLoading, setIsLoading] = useState(true);

  // Load initial data and subscribe to realtime
  useEffect(() => {
    async function loadData() {
      try {
        const { data, error } = await supabase
          .from('sabor_lucro_state')
          .select('state_json')
          .eq('id', '00000000-0000-0000-0000-000000000001')
          .single();
        
        if (data && data.state_json) {
          setState(data.state_json as AppState);
        } else if (!error) {
           const saved = localStorage.getItem('sabor_lucro_state');
           if (saved) setState(JSON.parse(saved));
        }
      } catch (err) {
        console.error("Erro ao carregar do Supabase:", err);
      } finally {
        setIsLoading(false);
      }
    }
    loadData();

    // Sincronização em tempo real
    const channel = supabase
      .channel('sabor_lucro_realtime')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'sabor_lucro_state',
          filter: 'id=eq.00000000-0000-0000-0000-000000000001'
        },
        (payload) => {
          if (payload.new && payload.new.state_json) {
            // Atualiza o estado local apenas com os dados mais recentes da nuvem
            setState(payload.new.state_json as AppState);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  // Save data on change
  useEffect(() => {
    if (isLoading) return; // Don't save while loading
    
    // Save to local storage as backup
    localStorage.setItem('sabor_lucro_state', JSON.stringify(state));

    // Save to Supabase
    const saveToSupabase = async () => {
      try {
        await supabase
          .from('sabor_lucro_state')
          .update({ state_json: state, updated_at: new Date().toISOString() })
          .eq('id', '00000000-0000-0000-0000-000000000001');
      } catch (err) {
        console.error("Erro ao salvar no Supabase:", err);
      }
    };
    
    // Debounce to prevent too many requests
    const timeoutId = setTimeout(saveToSupabase, 1000);
    return () => clearTimeout(timeoutId);
  }, [state, isLoading]);

  // Calculations
  const totalFixedCosts = state.fixedCosts.gas + state.fixedCosts.energy + state.fixedCosts.transport + state.fixedCosts.internet + state.fixedCosts.others;
  const fixedCostPerUnit = state.fixedCosts.monthlyProductionUnits > 0 ? totalFixedCosts / state.fixedCosts.monthlyProductionUnits : 0;

  const calculateUnitCost = (recipe: Recipe) => {
    const ingredientsCost = recipe.ingredients.reduce((sum, ing) => sum + ing.cost, 0);
    const ingredientsPerUnit = recipe.quantityProduced > 0 ? ingredientsCost / recipe.quantityProduced : 0;
    
    const laborTotal = state.laborConfig.hourlyRate * recipe.productionTimeHours;
    const laborPerUnit = recipe.quantityProduced > 0 ? laborTotal / recipe.quantityProduced : 0;

    return ingredientsPerUnit + fixedCostPerUnit + laborPerUnit;
  };

  const navItems = [
    { id: 'dashboard', label: 'Painel', icon: LayoutDashboard },
    { id: 'production', label: 'Receitas', icon: ChefHat },
    { id: 'fixed_costs', label: 'Custos Fixos', icon: Wallet },
    { id: 'pricing', label: 'Precificação', icon: Tag },
    { id: 'sales', label: 'Vendas', icon: ShoppingBag },
  ];

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans pb-24 md:pb-0 md:pl-64">
      {/* Sidebar - Desktop */}
      <aside className="hidden md:flex flex-col w-64 bg-white border-r border-slate-200 fixed inset-y-0 left-0 p-6">
        <h1 className="text-2xl font-bold text-emerald-600 mb-8 flex items-center gap-2">
          <ChefHat className="w-8 h-8" />
          Sabor & Lucro
        </h1>
        <nav className="space-y-1">
          {navItems.map((item) => (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id as TabType)}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-colors ${
                activeTab === item.id 
                ? 'bg-emerald-50 text-emerald-700 font-medium' 
                : 'text-slate-500 hover:bg-slate-50 hover:text-slate-700'
              }`}
            >
              <item.icon className="w-5 h-5" />
              {item.label}
            </button>
          ))}
        </nav>
      </aside>

      {/* Loading Overlay */}
      {isLoading && (
        <div className="fixed inset-0 bg-white/80 z-[100] flex items-center justify-center backdrop-blur-sm">
          <div className="flex flex-col items-center gap-4">
            <div className="w-12 h-12 border-4 border-emerald-200 border-t-emerald-600 rounded-full animate-spin"></div>
            <p className="text-emerald-800 font-medium animate-pulse">Sincronizando dados...</p>
          </div>
        </div>
      )}

      {/* Bottom Nav - Mobile */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 flex justify-around p-2 z-50">
        {navItems.map((item) => (
          <button
            key={item.id}
            onClick={() => setActiveTab(item.id as TabType)}
            className={`flex flex-col items-center gap-1 p-2 transition-colors ${
              activeTab === item.id ? 'text-emerald-600' : 'text-slate-400'
            }`}
          >
            <item.icon className="w-6 h-6" />
            <span className="text-[10px] uppercase font-bold tracking-wider">{item.label}</span>
          </button>
        ))}
      </nav>

      {/* Main Content */}
      <main className="p-4 md:p-8 max-w-5xl mx-auto">
        <header className="mb-8 md:flex md:items-center md:justify-between">
          <div>
            <h2 className="text-2xl font-bold text-slate-800">
              {navItems.find(i => i.id === activeTab)?.label}
            </h2>
            <p className="text-slate-500">Controle financeiro para seu negócio artesanal</p>
          </div>
          {/* Global quick stats maybe? */}
        </header>

        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
          >
            {activeTab === 'dashboard' && <DashboardTab state={state} calculateUnitCost={calculateUnitCost} />}
            {activeTab === 'production' && <ProductionTab state={state} setState={setState} />}
            {activeTab === 'fixed_costs' && <FixedCostsTab state={state} setState={setState} />}
            {activeTab === 'pricing' && <PricingTab state={state} calculateUnitCost={calculateUnitCost} />}
            {activeTab === 'sales' && <SalesTab state={state} setState={setState} calculateUnitCost={calculateUnitCost} />}
          </motion.div>
        </AnimatePresence>
      </main>
    </div>
  );
}

// Sub-components will be implemented below or in separate files.
// For brevity and to ensure everything is connected, I will define them here as functions first,
// and if they get too big, I'll move them.

function DashboardTab({ state, calculateUnitCost }: { state: AppState, calculateUnitCost: (r: Recipe) => number }) {
  const currentMonth = new Date().toISOString().slice(0, 7);
  const monthSales = state.sales.filter(s => s.date.startsWith(currentMonth));
  
  const totalProduced = state.recipes.reduce((sum, r) => sum + r.quantityProduced, 0);
  const totalSold = monthSales.reduce((sum, s) => sum + s.quantitySold, 0);
  
  const totalRevenue = monthSales.reduce((sum, s) => sum + (s.unitPrice * s.quantitySold), 0);
  const totalCosts = monthSales.reduce((sum, s) => {
    const recipe = state.recipes.find(r => r.id === s.recipeId);
    if (!recipe) return sum;
    return sum + (calculateUnitCost(recipe) * s.quantitySold);
  }, 0);
  
  const totalProfit = totalRevenue - totalCosts;
  const avgMargin = totalRevenue > 0 ? (totalProfit / totalRevenue) * 100 : 0;

  const alerts = [];
  if (avgMargin > 0 && avgMargin < 20) {
    alerts.push({ text: "Sua margem está baixa (abaixo de 20%). Revise seus preços!", type: 'warning' });
  }
  
  const lowPriceRecipes = state.recipes.filter(r => {
    const cost = calculateUnitCost(r);
    const relatedSales = monthSales.filter(s => s.recipeId === r.id);
    return relatedSales.some(s => s.unitPrice < cost * 2);
  });

  if (lowPriceRecipes.length > 0) {
    alerts.push({ text: "Você tem produtos sendo vendidos abaixo do preço ideal sugerido.", type: 'warning' });
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 bg-emerald-50 text-emerald-600 rounded-lg">
              <TrendingUp className="w-5 h-5" />
            </div>
            <span className="text-slate-500 font-medium">Lucro Mensal</span>
          </div>
          <p className={`text-3xl font-bold ${totalProfit >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
            R$ {totalProfit.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
          </p>
        </div>

        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 bg-blue-50 text-blue-600 rounded-lg">
              <ShoppingBag className="w-5 h-5" />
            </div>
            <span className="text-slate-500 font-medium">Total Vendido</span>
          </div>
          <p className="text-3xl font-bold text-slate-800">{totalSold} un</p>
        </div>

        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 bg-purple-50 text-purple-600 rounded-lg">
              <TrendingUp className="w-5 h-5" />
            </div>
            <span className="text-slate-500 font-medium">Margem Média</span>
          </div>
          <p className="text-3xl font-bold text-slate-800">{avgMargin.toFixed(1)}%</p>
        </div>
      </div>

      <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
        <h3 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
          <AlertCircle className="w-5 h-5 text-emerald-600" />
          Consultor Sabor & Lucro
        </h3>
        <div className="space-y-3">
          {alerts.length > 0 ? alerts.map((alert, idx) => (
            <div key={idx} className="flex items-start gap-3 p-4 bg-amber-50 border border-amber-100 rounded-xl text-amber-800">
              <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
              <p className="font-medium">{alert.text}</p>
            </div>
          )) : (
            <div className="flex items-start gap-3 p-4 bg-emerald-50 border border-emerald-100 rounded-xl text-emerald-800">
              <TrendingUp className="w-5 h-5 shrink-0 mt-0.5" />
              <p className="font-medium">Parabéns! Seus indicadores estão saudáveis no momento.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function ProductionTab({ state, setState }: { state: AppState, setState: Dispatch<SetStateAction<AppState>> }) {
  const [isAdding, setIsAdding] = useState(false);
  const [newRecipe, setNewRecipe] = useState<Partial<Recipe>>({
    name: '',
    ingredients: [],
    quantityProduced: 1,
    productionTimeHours: 1,
  });

  const addIngredient = () => {
    const ingName = prompt("Nome do ingrediente:");
    let ingCost = prompt("Custo do ingrediente (Ex: 10.50 ou 0,50):");
    if (ingName && ingCost) {
      ingCost = ingCost.replace(',', '.');
      const parsedCost = parseFloat(ingCost);
      
      if (!isNaN(parsedCost) && parsedCost >= 0) {
        setNewRecipe({
          ...newRecipe,
          ingredients: [...(newRecipe.ingredients || []), { id: Date.now().toString(), name: ingName, cost: parsedCost }]
        });
      } else {
        alert("Valor inválido! Por favor, insira um número válido (ex: 0.50 ou 0,50)");
      }
    }
  };

  const removeIngredient = (id: string) => {
    setNewRecipe({
      ...newRecipe,
      ingredients: newRecipe.ingredients?.filter(i => i.id !== id)
    });
  };

  const saveRecipe = () => {
    if (newRecipe.name && newRecipe.ingredients?.length) {
      setState(prev => ({
        ...prev,
        recipes: [...prev.recipes, { ...newRecipe, id: Date.now().toString() } as Recipe]
      }));
      setIsAdding(false);
      setNewRecipe({ name: '', ingredients: [], quantityProduced: 1, productionTimeHours: 1 });
    }
  };

  const deleteRecipe = (id: string) => {
    if (confirm("Deseja excluir esta receita?")) {
      setState(prev => ({ ...prev, recipes: prev.recipes.filter(r => r.id !== id) }));
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-end">
        {!isAdding && (
          <button 
            onClick={() => setIsAdding(true)}
            className="bg-emerald-600 text-white px-6 py-2 rounded-xl flex items-center gap-2 hover:bg-emerald-700 transition-colors"
          >
            <Plus className="w-5 h-5" /> Nova Receita
          </button>
        )}
      </div>

      {isAdding && (
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 space-y-4">
          <h3 className="text-xl font-bold">Adicionar Receita</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Nome do Produto</label>
              <input 
                value={newRecipe.name}
                onChange={e => setNewRecipe({...newRecipe, name: e.target.value})}
                className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none"
                placeholder="Ex: Bolo de Chocolate"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Qtd Produzida</label>
                <input 
                  type="number"
                  value={newRecipe.quantityProduced}
                  onChange={e => setNewRecipe({...newRecipe, quantityProduced: parseFloat(e.target.value)})}
                  className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Tempo (Horas)</label>
                <input 
                  type="number"
                  step="0.1"
                  value={newRecipe.productionTimeHours}
                  onChange={e => setNewRecipe({...newRecipe, productionTimeHours: parseFloat(e.target.value)})}
                  className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none"
                />
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <h4 className="font-bold text-slate-700">Ingredientes</h4>
              <button 
                onClick={addIngredient}
                className="text-emerald-600 font-medium flex items-center gap-1 hover:underline"
              >
                <Plus className="w-4 h-4" /> Add Ingrediente
              </button>
            </div>
            <div className="space-y-2">
              {newRecipe.ingredients?.map(ing => (
                <div key={ing.id} className="flex justify-between p-3 bg-slate-50 rounded-lg border border-slate-100">
                  <span>{ing.name}</span>
                  <div className="flex gap-4 items-center">
                    <span className="font-bold">R$ {ing.cost.toFixed(2)}</span>
                    <button onClick={() => removeIngredient(ing.id)} className="text-rose-500">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="flex gap-4 justify-end pt-4 border-t border-slate-100">
            <button onClick={() => setIsAdding(false)} className="px-6 py-2 text-slate-500">Cancelar</button>
            <button onClick={saveRecipe} className="bg-emerald-600 text-white px-8 py-2 rounded-xl">Salvar</button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {state.recipes.map(recipe => {
          const totalCost = recipe.ingredients.reduce((sum, i) => sum + i.cost, 0);
          return (
            <div key={recipe.id} className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
              <div className="flex justify-between items-start mb-4">
                <h3 className="text-lg font-bold text-slate-800">{recipe.name}</h3>
                <button onClick={() => deleteRecipe(recipe.id)} className="text-slate-400 hover:text-rose-500 transition-colors">
                  <Trash2 className="w-5 h-5" />
                </button>
              </div>
              <div className="grid grid-cols-2 gap-4 mb-4">
                <div className="bg-slate-50 p-3 rounded-xl text-center">
                  <p className="text-xs text-slate-500 uppercase font-bold tracking-wider mb-1">Custo Total</p>
                  <p className="text-xl font-bold text-slate-800">R$ {totalCost.toFixed(2)}</p>
                </div>
                <div className="bg-emerald-50 p-3 rounded-xl text-center">
                  <p className="text-xs text-emerald-600 uppercase font-bold tracking-wider mb-1">Por Unidade</p>
                  <p className="text-xl font-bold text-emerald-700">R$ {(totalCost / recipe.quantityProduced).toFixed(2)}</p>
                </div>
              </div>
              <p className="text-sm text-slate-500">{recipe.ingredients.length} ingredientes • Rendimento: {recipe.quantityProduced} un</p>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function FixedCostsTab({ state, setState }: { state: AppState, setState: Dispatch<SetStateAction<AppState>> }) {
  const updateFixed = (field: keyof FixedCosts, value: number) => {
    setState(prev => ({
      ...prev,
      fixedCosts: { ...prev.fixedCosts, [field]: value }
    }));
  };

  const total = state.fixedCosts.gas + state.fixedCosts.energy + state.fixedCosts.transport + state.fixedCosts.internet + state.fixedCosts.others;

  return (
    <div className="space-y-6">
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 grid grid-cols-1 md:grid-cols-2 gap-8">
        <div className="space-y-4">
          <h3 className="text-xl font-bold mb-4">Custos do Mês</h3>
          {[
            { label: 'Gás', icon: Wallet, field: 'gas' },
            { label: 'Energia', icon: Wallet, field: 'energy' },
            { label: 'Transporte', icon: Wallet, field: 'transport' },
            { label: 'Internet', icon: Wallet, field: 'internet' },
            { label: 'Outros', icon: Wallet, field: 'others' },
          ].map(item => (
            <div key={item.field}>
              <label className="block text-sm font-medium text-slate-700 mb-1">{item.label}</label>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-medium">R$</span>
                <input 
                  type="number"
                  value={state.fixedCosts[item.field as keyof FixedCosts]}
                  onChange={e => updateFixed(item.field as keyof FixedCosts, parseFloat(e.target.value) || 0)}
                  className="w-full pl-12 pr-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none"
                />
              </div>
            </div>
          ))}

          <div className="pt-4 border-t border-slate-100">
            <label className="block text-sm font-medium text-slate-700 mb-1">Mão de Obra (Valor por Hora)</label>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-medium">R$</span>
              <input 
                type="number"
                value={state.laborConfig.hourlyRate}
                onChange={e => setState(prev => ({ ...prev, laborConfig: { hourlyRate: parseFloat(e.target.value) || 0 } }))}
                className="w-full pl-12 pr-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none"
                placeholder="Ex: 15.00"
              />
            </div>
            <p className="text-xs text-slate-500 mt-2">Dica: Inclua tempo de compras, limpeza e preparo.</p>
          </div>
        </div>

        <div className="space-y-6">
          <div className="bg-emerald-600 text-white p-8 rounded-3xl space-y-4 shadow-xl shadow-emerald-100">
            <p className="text-emerald-100 font-medium text-lg">Total de Custos Fixos</p>
            <p className="text-4xl font-bold">R$ {total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
            <div className="pt-6 border-t border-emerald-500/30">
              <label className="block text-sm font-medium text-emerald-100 mb-2 uppercase tracking-wider">Produção Mensal Total (unades)</label>
              <input 
                type="number"
                value={state.fixedCosts.monthlyProductionUnits}
                onChange={e => updateFixed('monthlyProductionUnits', parseInt(e.target.value) || 1)}
                className="w-full bg-emerald-500/20 border border-emerald-400/30 px-4 py-3 rounded-xl text-white outline-none placeholder:text-emerald-300"
                placeholder="Ex: 500"
              />
              <p className="mt-4 text-emerald-100/80 text-sm italic">
                Este valor divide os custos mensais por cada unidade que você produz.
              </p>
            </div>
          </div>

          <div className="bg-white p-6 border-2 border-dashed border-slate-200 rounded-3xl text-center">
            <p className="text-slate-500 font-medium mb-1">Custo fixo por unidade</p>
            <p className="text-2xl font-bold text-slate-800">R$ {(state.fixedCosts.monthlyProductionUnits > 0 ? total / state.fixedCosts.monthlyProductionUnits : 0).toFixed(2)}</p>
          </div>
        </div>
      </div>
    </div>
  );
}


function PricingTab({ state, calculateUnitCost }: { state: AppState, calculateUnitCost: (r: Recipe) => number }) {
  const [selectedRecipeId, setSelectedRecipeId] = useState<string>(state.recipes[0]?.id || '');
  const recipe = state.recipes.find(r => r.id === selectedRecipeId);
  const cost = recipe ? calculateUnitCost(recipe) : 0;
  
  const [simPrice, setSimPrice] = useState(cost * 2.5);
  const [comboUnits, setComboUnits] = useState(5);
  const [comboPrice, setComboPrice] = useState(cost * comboUnits * 0.9); // 10% discount default

  useEffect(() => {
    if (cost > 0) {
      setSimPrice(cost * 2.5);
      setComboPrice(cost * 5 * 0.9);
    }
  }, [cost]);

  const simProfit = simPrice - cost;
  const simMargin = simPrice > 0 ? (simProfit / simPrice) * 100 : 0;

  const comboTotalCost = cost * comboUnits;
  const comboProfit = comboPrice - comboTotalCost;
  const comboMargin = comboPrice > 0 ? (comboProfit / comboPrice) * 100 : 0;

  return (
    <div className="space-y-6">
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
        <label className="block text-sm font-medium text-slate-700 mb-2">Selecione um Produto</label>
        <select 
          value={selectedRecipeId}
          onChange={e => setSelectedRecipeId(e.target.value)}
          className="w-full p-4 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-emerald-500 font-bold text-slate-700 text-lg"
        >
          {state.recipes.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
          {state.recipes.length === 0 && <option value="">Nenhuma receita cadastrada</option>}
        </select>
      </div>

      {recipe ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div className="space-y-6">
            <div className="bg-emerald-600 text-white p-8 rounded-3xl shadow-xl shadow-emerald-100">
              <p className="text-emerald-100 font-medium mb-1">Custo Total Unitário</p>
              <p className="text-4xl font-bold mb-4">R$ {cost.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
              <div className="space-y-2 text-sm text-emerald-100/80 pt-4 border-t border-emerald-500">
                <div className="flex justify-between">
                  <span>Ingredientes:</span>
                  <span>R$ {(recipe.ingredients.reduce((s, i) => s + i.cost, 0) / recipe.quantityProduced).toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Custos Fixos:</span>
                  <span>R$ {( (state.fixedCosts.gas + state.fixedCosts.energy + state.fixedCosts.transport + state.fixedCosts.internet + state.fixedCosts.others) / state.fixedCosts.monthlyProductionUnits ).toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Mão de Obra:</span>
                  <span>R$ {( (state.laborConfig.hourlyRate * recipe.productionTimeHours) / recipe.quantityProduced ).toFixed(2)}</span>
                </div>
              </div>
            </div>

            {/* Price Simulator */}
            <div className="bg-white p-6 rounded-2xl border border-slate-100">
              <h4 className="font-bold mb-4 flex items-center gap-2">
                <AlertCircle className="w-5 h-5 text-emerald-600" />
                Simulador de Margem
              </h4>
              <div className="space-y-4">
                <div className="flex justify-between text-sm">
                   <label className="text-slate-500 font-medium">Testar Preço</label>
                   <span className="font-bold text-emerald-600">R$ {simPrice.toFixed(2)}</span>
                </div>
                <input 
                  type="range" 
                  min={cost * 0.5} 
                  max={cost * 5} 
                  step="0.1" 
                  value={simPrice}
                  className="w-full accent-emerald-600 cursor-pointer" 
                  onChange={e => setSimPrice(parseFloat(e.target.value))}
                />
                <div className="p-4 bg-slate-50 rounded-xl flex justify-between items-center">
                  <div>
                    <p className="text-xs text-slate-400 uppercase font-bold">Lucro/Unidade</p>
                    <p className={`text-lg font-bold ${simProfit >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                      R$ {simProfit.toFixed(2)}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-slate-400 uppercase font-bold">Margem</p>
                    <p className={`text-lg font-bold ${simMargin >= 20 ? 'text-emerald-600' : simMargin > 0 ? 'text-amber-600' : 'text-rose-600'}`}>
                      {simMargin.toFixed(1)}%
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Combo Simulator */}
            <div className="bg-white p-6 rounded-2xl border border-blue-100 bg-blue-50/30">
              <h4 className="font-bold mb-4 flex items-center gap-2 text-blue-700">
                <ShoppingBag className="w-5 h-5" />
                Modo Combo
              </h4>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Unidades</label>
                    <input 
                      type="number" 
                      value={comboUnits}
                      onChange={e => setComboUnits(parseInt(e.target.value) || 1)}
                      className="w-full p-2 border border-blue-200 rounded-lg outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Preço Total Combo</label>
                    <input 
                      type="number" 
                      value={comboPrice}
                      onChange={e => setComboPrice(parseFloat(e.target.value) || 0)}
                      className="w-full p-2 border border-blue-200 rounded-lg outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>
                <div className="p-4 bg-blue-600 text-white rounded-xl flex justify-between items-center shadow-lg shadow-blue-100">
                    <div>
                      <p className="text-[10px] uppercase font-bold opacity-80">Lucro do Combo</p>
                      <p className="text-xl font-bold">R$ {comboProfit.toFixed(2)}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-[10px] uppercase font-bold opacity-80">Margem do Combo</p>
                      <p className="text-xl font-bold">{comboMargin.toFixed(1)}%</p>
                    </div>
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <h4 className="text-lg font-bold text-slate-800">Sugestões de Preço</h4>
            <div className="space-y-3">
              {[
                { label: 'Preço Mínimo (2x)', multiplier: 2, desc: 'Ideal para vendas em atacado ou revenda.' },
                { label: 'Preço Ideal (2.5x)', multiplier: 2.5, desc: 'Garante boa margem e cobre imprevistos.', best: true },
                { label: 'Preço Premium (3x)', multiplier: 3, desc: 'Indicado para público exclusivo ou encomendas.' },
              ].map(opt => (
                <div key={opt.multiplier} className={`p-6 rounded-2xl border transition-all ${opt.best ? 'bg-emerald-50 border-emerald-200' : 'bg-white border-slate-200 shadow-sm'}`}>
                  <div className="flex justify-between items-start mb-2">
                    <span className="font-bold text-slate-700">{opt.label}</span>
                    {opt.best && <span className="bg-emerald-600 text-white text-[10px] font-bold px-2 py-1 rounded-md uppercase">Recomendado</span>}
                  </div>
                  <p className="text-3xl font-bold text-slate-800 mb-2">R$ {(cost * opt.multiplier).toFixed(2)}</p>
                  <p className="text-xs text-slate-500 leading-relaxed font-medium">{opt.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : (
        <div className="text-center p-12 bg-white rounded-2xl border-2 border-dashed border-slate-200">
           <p className="text-slate-400">Cadastre suas receitas para ver as sugestões de preço.</p>
        </div>
      )}
    </div>
  );
}


function SalesTab({ state, setState, calculateUnitCost }: { state: AppState, setState: Dispatch<SetStateAction<AppState>>, calculateUnitCost: (r: Recipe) => number }) {
  const [saleInput, setSaleInput] = useState({
    recipeId: '',
    quantitySold: 1,
    unitPrice: 0,
  });

  const recipes = state.recipes;

  const addSale = () => {
    if (saleInput.recipeId && saleInput.quantitySold > 0 && saleInput.unitPrice > 0) {
      setState(prev => ({
        ...prev,
        sales: [...prev.sales, { ...saleInput, id: Date.now().toString(), date: new Date().toISOString() }]
      }));
      setSaleInput({ recipeId: '', quantitySold: 1, unitPrice: 0 });
    }
  };

  const removeSale = (id: string) => {
     setState(prev => ({ ...prev, sales: prev.sales.filter(s => s.id !== id) }));
  };

  return (
    <div className="space-y-6">
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex flex-col md:flex-row gap-4 items-end">
        <div className="flex-1 w-full">
          <label className="block text-sm font-medium text-slate-700 mb-1">Produto</label>
          <select 
             value={saleInput.recipeId}
             onChange={e => {
               const rid = e.target.value;
               const rec = state.recipes.find(r => r.id === rid);
               setSaleInput({ ...saleInput, recipeId: rid, unitPrice: rec ? calculateUnitCost(rec) * 2.5 : 0 });
             }}
             className="w-full px-4 py-2 border border-slate-200 rounded-lg outline-none"
          >
            <option value="">Selecione...</option>
            {recipes.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
          </select>
        </div>
        <div className="w-24 w-full md:w-24">
          <label className="block text-sm font-medium text-slate-700 mb-1">Qtd</label>
          <input 
            type="number"
            value={saleInput.quantitySold}
            onChange={e => setSaleInput({ ...saleInput, quantitySold: parseFloat(e.target.value) })}
            className="w-full px-4 py-2 border border-slate-200 rounded-lg outline-none"
          />
        </div>
        <div className="flex-1 w-full">
          <label className="block text-sm font-medium text-slate-700 mb-1">Preço/Un</label>
          <input 
            type="number"
            value={saleInput.unitPrice}
            onChange={e => setSaleInput({ ...saleInput, unitPrice: parseFloat(e.target.value) })}
            className="w-full px-4 py-2 border border-slate-200 rounded-lg outline-none"
          />
        </div>
        <button 
          onClick={addSale}
          className="bg-emerald-600 text-white px-8 py-2 rounded-xl hover:bg-emerald-700 transition-colors h-[42px]"
        >
          Lançar Venda
        </button>
      </div>

      <div className="space-y-4">
        {state.sales.slice().reverse().map(sale => {
          const recipe = recipes.find(r => r.id === sale.recipeId);
          if (!recipe) return null;
          const cost = calculateUnitCost(recipe);
          const profit = (sale.unitPrice - cost) * sale.quantitySold;
          const margin = ( (sale.unitPrice - cost) / sale.unitPrice ) * 100;

          return (
            <div key={sale.id} className="bg-white p-4 rounded-xl border border-slate-100 flex justify-between items-center">
              <div>
                <h4 className="font-bold text-slate-700">{recipe.name}</h4>
                <p className="text-xs text-slate-400">{new Date(sale.date).toLocaleDateString()} • {sale.quantitySold} un × R$ {sale.unitPrice.toFixed(2)}</p>
              </div>
              <div className="flex items-center gap-6">
                <div className="text-right">
                  <p className={`font-bold ${profit >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                    + R$ {profit.toFixed(2)}
                  </p>
                  <p className="text-[10px] uppercase font-bold text-slate-400">Margem: {margin.toFixed(1)}%</p>
                </div>
                <button onClick={() => removeSale(sale.id)} className="text-slate-300 hover:text-rose-500">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

