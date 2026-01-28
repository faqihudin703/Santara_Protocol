import { useState, useEffect } from "react";
import { 
  Activity, ShieldCheck, AlertTriangle, Clock, Database,
  TrendingUp, TrendingDown, ArrowUpRight, Maximize2, Sliders, Minus
} from "lucide-react";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

// ──────────────── CONFIG ────────────────
const RELAY_API = "http://localhost:40865"; 
const INDODAX_API_URL = "https://indodax.com/api/ticker/ethidr";

function App() {
  const [data, setData] = useState(null);
  const [prevPrice, setPrevPrice] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [lastUpdate, setLastUpdate] = useState(new Date());
  const [chartData, setChartData] = useState([]);

  const fetchData = async () => {
    try {
      const [priceRes, healthRes, metricsRes] = await Promise.all([
        fetch(`${RELAY_API}/public/price`),
        fetch(`${RELAY_API}/public/health`),
        fetch(`${RELAY_API}/public/metrics`)
      ]);

      if (!priceRes.ok || !healthRes.ok) throw new Error("Relay Unreachable");

      const price = await priceRes.json();
      const health = await healthRes.json();
      const metrics = await metricsRes.json();
      const timestamp = new Date().toLocaleTimeString();

      setData({ ...price, ...health, ...metrics });

      setChartData(current => {
        const newData = [...current, { time: timestamp, price: price.price_idr }];
        if (newData.length > 20) newData.shift();
        return newData;
      });

      setError(null);
      setLastUpdate(new Date());
    } catch (err) {
      console.error(err);
      setError("Failed to connect to Oracle Relay");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 5000);
    return () => clearInterval(interval);
  }, []);
  
  const diff = data?.price_change || 0;
  const isUp = diff > 0;
  const isDown = diff < 0;
  const isNeutral = diff === 0;

  const getScoreColor = (score) => {
    if (score >= 90) return "text-green-400";
    if (score >= 60) return "text-yellow-400";
    return "text-red-400";
  };

  if (loading && !data) return (
    <div className="h-screen flex flex-col items-center justify-center bg-[#050505] text-gray-500 gap-4">
      <div className="animate-spin w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full"></div>
      <p>Syncing with Oracle Node...</p>
    </div>
  );

  return (
    <div className="min-h-screen p-4 md:p-8 max-w-7xl mx-auto font-sans bg-[#050505] text-white">
      
      {/* ─── HEADER ─── */}
      <header className="flex flex-col md:flex-row justify-between items-center mb-8 border-b border-gray-800 pb-6">
        <div className="flex items-center gap-4 mb-4 md:mb-0">
          <div className="w-12 h-12 bg-blue-600 rounded-xl flex items-center justify-center shadow-lg shadow-blue-900/20">
            <Activity className="text-white w-7 h-7" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Santara Oracle Dashboard</h1>
            <div className="flex items-center gap-2 text-sm text-gray-400">
               <span className="flex h-2 w-2 relative">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
               </span>
               Live Price Feed
               <span className="ml-2 bg-blue-900/50 text-blue-300 border border-blue-500/30 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide">
                 Base Sepolia Testnet
               </span>
            </div>
          </div>
        </div>

        <div className="flex flex-col items-end">
           <div className={`px-3 py-1 rounded-full border text-xs font-bold mb-2 flex items-center gap-2 ${error ? 'bg-red-900/20 border-red-500/50 text-red-400' : 'bg-green-900/20 border-green-500/50 text-green-400'}`}>
              {error ? <AlertTriangle className="w-3 h-3"/> : <ShieldCheck className="w-3 h-3"/>}
              {error ? "RELAY DISCONNECTED" : "SYSTEM OPERATIONAL"}
           </div>
           <span className="text-[10px] text-gray-600 font-mono">
            Relay Sync: {lastUpdate.toLocaleTimeString()}
           </span>
        </div>
      </header>

      {/* ─── CONTENT GRID ─── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
        
        {/* LEFT COLUMN: PRICE & CHART */}
        <div className="lg:col-span-2 space-y-6">
           
           {/* MAIN PRICE CARD */}
           <div className="bg-[#0a0a0a] border border-gray-800 p-6 rounded-2xl shadow-xl relative overflow-hidden">
              <div className="flex justify-between items-start mb-6">
                 <div>
                    <div className="flex items-center gap-2 mb-1">
                       <span className="text-blue-400 text-xs font-bold uppercase tracking-wider">{data.pair}</span>
                       <span className={`text-[10px] px-2 py-0.5 rounded border uppercase font-bold ${data.price_state === 'fresh' ? 'bg-green-500/10 text-green-400 border-green-500/20' : 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20'}`}>
                          {data.price_state}
                       </span>
                    </div>
                    <h2 className="text-gray-400 text-sm">Real-time Oracle Price</h2>
                 </div>
                 
                 {/* PRICE CHANGE INDICATOR */}
                 <div className={`text-right ${isUp ? 'text-green-400' : isDown ? 'text-red-400' : 'text-gray-500'}`}>
                    <div className="flex items-center justify-end gap-1 font-bold text-sm">
                       {isUp && <TrendingUp className="w-4 h-4"/>}
                       {isDown && <TrendingDown className="w-4 h-4"/>}
                       {isNeutral && <Minus className="w-4 h-4"/>}
                       
                       {isNeutral ? 'No Change' : (
                         <>
                           {isUp ? '+' : ''}Rp {Math.abs(diff).toLocaleString('id-ID')}
                         </>
                       )}
                    </div>
                    <p className="text-[10px] text-gray-500">
                      prev: Rp {(data.previous_price || data.price_idr).toLocaleString('id-ID')}
                    </p>
                 </div>
              </div>

              <div className="text-5xl font-mono font-bold text-white tracking-tighter mb-6">
                 {data.formatted_price}
              </div>

              <div className="border-t border-gray-800 pt-4 flex items-center gap-4 text-xs">
                 <div className="flex items-center gap-2 text-gray-400">
                    <span>Source:</span>
                    <a href={INDODAX_API_URL} target="_blank" className="text-blue-400 hover:text-white flex items-center gap-1 transition">
                       <img src="https://indodax.com/v2/logo/png/color/eth.png" className="w-4 h-4 grayscale hover:grayscale-0" alt="Indodax"/>
                       Indodax API <ArrowUpRight className="w-3 h-3"/>
                    </a>
                 </div>
                 <div className="text-gray-600">|</div>
                 <div className="text-gray-400">Method: <span className="text-white capitalize">{data.aggregation}</span></div>
              </div>
           </div>

           {/* LIVE CHART */}
           <div className="bg-[#0a0a0a] border border-gray-800 p-6 rounded-2xl h-[300px]">
              <h3 className="text-xs font-bold text-gray-500 uppercase mb-4 flex items-center gap-2">
                 <Activity className="w-4 h-4"/> Live Price Volatility (Session)
              </h3>
              <div className="h-[220px] w-full">
                 <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={chartData}>
                       <defs>
                          <linearGradient id="colorPrice" x1="0" y1="0" x2="0" y2="1">
                             <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3}/>
                             <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                          </linearGradient>
                       </defs>
                       <CartesianGrid strokeDasharray="3 3" stroke="#374151" vertical={false} opacity={0.5} />
                       <XAxis dataKey="time" hide />
                       <YAxis 
                          domain={['dataMin', 'dataMax']} 
                          orientation="right" 
                          tick={{fontSize: 10, fill: '#6b7280'}} 
                          axisLine={false} 
                          tickLine={false} 
                          width={60}
                          tickFormatter={(val) => `${(val/1000000).toFixed(3)}M`} 
                       />
                       <Tooltip 
                          contentStyle={{backgroundColor: '#111827', borderColor: '#374151', borderRadius: '8px', fontSize: '12px'}}
                          itemStyle={{color: '#60a5fa'}}
                          formatter={(value) => [`Rp ${value.toLocaleString('id-ID')}`, 'Price']}
                          labelStyle={{color: '#9ca3af', marginBottom: '0.5rem'}}
                       />
                       <Area 
                          type="monotone" 
                          dataKey="price" 
                          stroke="#3b82f6" 
                          strokeWidth={2} 
                          fillOpacity={1} 
                          fill="url(#colorPrice)" 
                          isAnimationActive={true}
                          animationDuration={500}
                       />
                    </AreaChart>
                 </ResponsiveContainer>
              </div>
           </div>

        </div>

        {/* RIGHT COLUMN: METRICS & SCORE */}
        <div className="space-y-6">
           
           {/* TRUST SCORE */}
           <div className="bg-[#0a0a0a] border border-gray-800 p-6 rounded-2xl text-center relative overflow-hidden">
               <div className="absolute inset-0 bg-gradient-to-b from-transparent to-blue-900/5 pointer-events-none"></div>
               <ShieldCheck className={`w-12 h-12 mx-auto mb-2 ${getScoreColor(data.oracle_score)}`} />
               <div className="text-gray-500 text-xs font-bold uppercase tracking-widest mb-2">Trust Score</div>
               <div className={`text-6xl font-bold mb-4 ${getScoreColor(data.oracle_score)}`}>{data.oracle_score}</div>
               
               <div className="w-full bg-gray-800 rounded-full h-1.5 mb-2 overflow-hidden">
                  <div className={`h-full transition-all duration-1000 ${data.oracle_score >= 90 ? 'bg-green-500' : 'bg-yellow-500'}`} style={{width: `${data.oracle_score}%`}}></div>
               </div>
               <p className="text-[10px] text-gray-500">Based on Deviation & Latency stability</p>
           </div>

           {/* TELEMETRY METRICS */}
           <div className="grid grid-cols-1 gap-3">
             
              {/* PRICE AGE */}
              <MetricItem 
                 icon={<Clock className="w-4 h-4 text-orange-400"/>}
                 label="Price Age"
                 value={`${data.price_age_seconds || 0}s`}
                 sub={`Max Allowed: ${data.heartbeat_interval_seconds}s`}
                 color={data.price_age_seconds < 300 ? "text-white" : "text-red-400"}
              />

              {/* THRESHOLD CONFIG */}
              <MetricItem 
                 icon={<Sliders className="w-4 h-4 text-blue-400"/>}
                 label="Deviation Threshold" 
                 value={`${data.price_deviation_threshold_percent || 0.6}%`} 
                 sub="Trigger limit for price update"
                 color="text-blue-300"
              />

              {/* STATS GRID */}
              <div className="grid grid-cols-2 gap-3">
                  <MetricItem 
                     icon={<TrendingUp className="w-4 h-4 text-purple-400"/>}
                     label="Avg Deviation"
                     value={`${data.avg_deviation_percent || 0}%`}
                     sub="Mean"
                     color="text-white"
                     compact={true} 
                  />
                  
                  <MetricItem 
                     icon={<Maximize2 className="w-4 h-4 text-pink-400"/>}
                     label="Max Deviation"
                     value={`${data.max_deviation_percent || 0}%`}
                     sub="Peak"
                     color={data.max_deviation_percent > data.price_deviation_threshold_percent ? "text-yellow-400" : "text-white"}
                     compact={true}
                  />
              </div>

              {/* DATA POINTS */}
              <MetricItem 
                 icon={<Database className="w-4 h-4 text-gray-400"/>}
                 label="Data Points"
                 value={data.total_price_checks}
                 sub="Total Lifetime Checks"
                 color="text-gray-500"
              />

           </div>
        </div>

      </div>

    </div>
  );
}

// ─── METRIC COMPONENT ───
function MetricItem({ icon, label, value, sub, color, compact }) {
   return (
      <div className={`bg-[#0a0a0a] border border-gray-800 p-3 rounded-xl flex ${compact ? 'flex-col items-start justify-center gap-1 min-h-[80px]' : 'items-center justify-between'}`}>
         
         <div className="flex items-center gap-3 w-full">
            <div className={`p-2 bg-gray-800/50 rounded-lg ${compact ? 'hidden' : 'block'}`}>{icon}</div>
            
            <div className="w-full">
               <div className="flex justify-between items-center">
                  <div className="text-[10px] text-gray-500 uppercase font-bold">{label}</div>
                  {compact && <div className="block md:hidden">{icon}</div>}
               </div>
               {!compact && <div className="text-[10px] text-gray-600">{sub}</div>}
            </div>
         </div>

         <div className={`font-mono font-bold ${color} ${compact ? 'text-lg mt-1' : 'text-xl'}`}>
            {value}
         </div>
      </div>
   );
}

export default App;