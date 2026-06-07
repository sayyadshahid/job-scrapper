import os
import json
from langchain_openai import ChatOpenAI
from langchain_core.prompts import PromptTemplate
from langchain_core.output_parsers import JsonOutputParser, StrOutputParser

def get_llm():
    api_key = os.getenv("DEEPSEEK_API_KEY")
    return ChatOpenAI(
        model="deepseek-chat",
        openai_api_key=api_key,
        openai_api_base="https://api.deepseek.com/v1",
        temperature=0.2
    )

def analyze_resume_match(job_desc: str, resume_text: str) -> dict:
    llm = get_llm()
    prompt = PromptTemplate(
        template="You are an expert ATS (Applicant Tracking System) optimizer. Given the following Job Description and the User's Resume, provide a match score from 0 to 100 based on how well the resume matches the job. Also, identify up to 5 critical missing keywords or skills from the job description that are missing in the resume.\n\nJob Description:\n{job_desc}\n\nResume:\n{resume}\n\nReturn ONLY a valid JSON object with the keys 'score' (an integer) and 'missing_keywords' (a comma-separated string).",
        input_variables=["job_desc", "resume"]
    )
    chain = prompt | llm | JsonOutputParser()
    try:
        result = chain.invoke({"job_desc": job_desc, "resume": resume_text})
        return {
            "score": result.get("score", 0),
            "missing_keywords": result.get("missing_keywords", "")
        }
    except Exception as e:
        print(f"Error analyzing resume: {e}")
        return {"score": 0, "missing_keywords": ""}

def generate_cold_email(job_desc: str, resume_text: str, contact_info: str) -> str:
    llm = get_llm()
    prompt = PromptTemplate(
        template="You are an expert career coach helping a candidate write a cold email to a recruiter.\n\nHere is the Job Description:\n{job_desc}\n\nHere is the Contact Info of the recruiter (if any):\n{contact_info}\n\nHere is the candidate's Resume:\n{resume}\n\nWrite a concise, highly professional cold outreach email to the recruiter. Keep it under 150 words. Focus on the candidate's strengths that directly match the job description. Do not include placeholders like [Your Name] if you can infer it from the resume, but use placeholders if the information is completely missing.",
        input_variables=["job_desc", "resume", "contact_info"]
    )
    chain = prompt | llm | StrOutputParser()
    try:
        result = chain.invoke({"job_desc": job_desc, "resume": resume_text, "contact_info": contact_info})
        return result
    except Exception as e:
        print(f"Error generating email: {e}")
        return "Error generating email draft."
