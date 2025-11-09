import torch
from transformers import AutoTokenizer, AutoModelForSequenceClassification
import pandas as pd


MODEL_NAME = "ProsusAI/finbert"


"""
NOTEEEE : have to merege the finbert with other data accoring to the times frames 
and then we can use the finbert to get the sentiment scores for each news article and then we can use those scores to train our model
"""


class FinBertEmbedder:
    
    def __init__(self):
        self.tokenizer = AutoTokenizer.from_pretrained(MODEL_NAME)
        self.model = AutoModelForSequenceClassification.from_pretrained(MODEL_NAME) 
        self.model.eval()   
        

    def get_sentiment(self,text):
        inputs = self.tokenizer(text,return_tensors="pt", truncation=True, max_length=512)
        with torch.no_grad():
            outputs = self.model(**inputs)
            probs = torch.nn.functional.softmax(outputs.logits, dim=-1)
            labels = ["positive", "negative", "neutral"]
            scores = {labels[i]: probs[0][i].item() for i in range(len(labels))}
        return scores
    
    
    def embed_dataframte(self,csv_path:str):
        df = pd.read_csv(csv_path)
        df["combined_text"] = df["headline"].fillna("") + " " + df["body"].fillna("")
        sentiments = df["combined_text"].apply(self.get_sentiment)
        df["positive"] = [s["positive"] for s in sentiments]
        df["negative"] = [s["negative"] for s in sentiments]
        df["neutral"]  = [s["neutral"] for s in sentiments]
        return df 